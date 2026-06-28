/**
 * GitHub deep-read for existing-project ingestion (public repos only).
 *
 * Uses Node's built-in fetch (no dependency, no token). Fetches repo metadata,
 * languages, the recursive file tree, and the contents of a BOUNDED set of
 * source files — capped by file count and total bytes so we stay within the
 * unauthenticated rate limit (60 req/hr) and a sane token budget for the LLM.
 * What gets dropped is reported in `truncated` (no silent caps).
 *
 * This module only READS a public repo; it stores and applies nothing. The
 * derived analysis flows through the review/gate like any other suggestion.
 */

import { httpError } from '../middleware/error.js';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const UA = 'spec-generator';

// Bounds for the deep read.
const MAX_FILES = 40;
const MAX_TOTAL_BYTES = 200 * 1024; // ~200 KB of source across all files
const MAX_FILE_BYTES = 40 * 1024;   // skip any single file larger than this

// Source-ish extensions worth reading; manifests first (they reveal the stack).
const SOURCE_EXT = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rb', 'java', 'kt', 'cs', 'php', 'rs',
  'swift', 'scala', 'ex', 'exs', 'sql', 'md',
]);
const MANIFESTS = new Set([
  'package.json', 'requirements.txt', 'pyproject.toml', 'pipfile', 'go.mod',
  'gemfile', 'pom.xml', 'build.gradle', 'cargo.toml', 'composer.json',
  'dockerfile', 'readme.md',
]);
// Vendored / generated / noise paths we never read.
const SKIP_RE =
  /(^|\/)(node_modules|dist|build|out|vendor|\.git|\.next|coverage|__pycache__|migrations|\.venv|venv)(\/|$)|\.(lock|min\.js|map|png|jpg|jpeg|gif|svg|ico|pdf|zip|woff2?|ttf)$/i;

/** Parse `owner` and `repo` from a GitHub URL (or `owner/repo` shorthand). */
export function parseRepoUrl(url) {
  const s = String(url || '').trim();
  const m = s.match(/github\.com[/:]([^/]+)\/([^/#?]+)/i) || s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) throw httpError(400, 'Could not parse a GitHub owner/repo from that URL.');
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
}

async function ghJson(path) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) throw httpError(400, 'Repository not found — is the URL correct and the repo public?');
  if (res.status === 403) throw httpError(429, 'GitHub rate limit reached (unauthenticated). Try again shortly.');
  if (!res.ok) throw httpError(502, `GitHub request failed (${res.status}).`);
  return res.json();
}

function rank(path) {
  const name = path.split('/').pop().toLowerCase();
  if (MANIFESTS.has(name)) return 0;                 // manifests first
  if (name === 'readme.md') return 0;
  const depth = path.split('/').length;
  return depth;                                       // then shallower files first
}

/**
 * Fetch a bounded snapshot of a public repo.
 * Returns { repo, stack, fileTree, files: [{ path, content }], truncated }.
 */
export async function fetchRepoSnapshot(url, { fetchImpl = fetch } = {}) {
  const { owner, repo } = parseRepoUrl(url);

  const meta = await ghJson(`/repos/${owner}/${repo}`);
  const branch = meta.default_branch || 'main';
  const [languages, tree] = await Promise.all([
    ghJson(`/repos/${owner}/${repo}/languages`),
    ghJson(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`),
  ]);

  const stack = Object.keys(languages || {});
  const blobs = (tree.tree || []).filter((n) => n.type === 'blob' && !SKIP_RE.test(n.path));
  const fileTree = blobs.map((n) => n.path);

  const candidates = blobs
    .filter((n) => {
      const name = n.path.split('/').pop().toLowerCase();
      const ext = name.includes('.') ? name.split('.').pop() : '';
      return MANIFESTS.has(name) || SOURCE_EXT.has(ext);
    })
    .filter((n) => (n.size ?? 0) <= MAX_FILE_BYTES)
    .sort((a, b) => rank(a.path) - rank(b.path));

  const files = [];
  let totalBytes = 0;
  let filesDropped = 0;
  for (const n of candidates) {
    if (files.length >= MAX_FILES || totalBytes >= MAX_TOTAL_BYTES) { filesDropped += 1; continue; }
    try {
      const res = await fetchImpl(`${RAW}/${owner}/${repo}/${branch}/${encodeURI(n.path)}`, {
        headers: { 'User-Agent': UA },
      });
      if (!res.ok) { filesDropped += 1; continue; }
      const content = await res.text();
      totalBytes += Buffer.byteLength(content);
      files.push({ path: n.path, content });
    } catch {
      filesDropped += 1;
    }
  }

  return {
    repo: { owner, repo, branch, description: meta.description || '', url: meta.html_url || url },
    stack,
    fileTree,
    files,
    truncated: {
      filesRead: files.length,
      filesDropped,
      totalFiles: fileTree.length,
      bytesRead: totalBytes,
      capped: filesDropped > 0,
    },
  };
}
