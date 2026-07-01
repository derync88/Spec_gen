import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchRepoSnapshot } from '../githubService.js';

// Stub the global fetch used by ghJson (repo metadata / languages / tree).
function stubApiFetch(record) {
  return async (url, opts) => {
    record.push({ url: String(url), headers: opts?.headers || {} });
    const u = String(url);
    if (u.endsWith('/languages')) return { ok: true, status: 200, json: async () => ({ JavaScript: 1 }) };
    if (u.includes('/git/trees/')) return { ok: true, status: 200, json: async () => ({ tree: [{ type: 'blob', path: 'README.md', size: 10 }] }) };
    return { ok: true, status: 200, json: async () => ({ default_branch: 'main', description: '', html_url: u }) };
  };
}

test('a token adds an Authorization header and fetches files via the contents API', async () => {
  const apiCalls = [];
  const fileCalls = [];
  const realFetch = global.fetch;
  global.fetch = stubApiFetch(apiCalls);
  try {
    const fetchImpl = async (url, opts) => {
      fileCalls.push({ url: String(url), headers: opts?.headers || {} });
      return { ok: true, text: async () => 'file contents' };
    };
    await fetchRepoSnapshot('https://github.com/owner/repo', { fetchImpl, token: 'TKN123' });

    // Metadata calls carry the token.
    assert.ok(apiCalls.every((c) => c.headers.Authorization === 'Bearer TKN123'));
    // File content fetched via the contents API (works for private repos), with auth.
    assert.equal(fileCalls.length, 1);
    assert.match(fileCalls[0].url, /\/repos\/owner\/repo\/contents\/README\.md/);
    assert.equal(fileCalls[0].headers.Authorization, 'Bearer TKN123');
  } finally {
    global.fetch = realFetch;
  }
});

test('without a token, no Authorization header and files come from the raw host', async () => {
  const apiCalls = [];
  const fileCalls = [];
  const realFetch = global.fetch;
  global.fetch = stubApiFetch(apiCalls);
  try {
    const fetchImpl = async (url, opts) => {
      fileCalls.push({ url: String(url), headers: opts?.headers || {} });
      return { ok: true, text: async () => 'file contents' };
    };
    await fetchRepoSnapshot('https://github.com/owner/repo', { fetchImpl });

    assert.ok(apiCalls.every((c) => !c.headers.Authorization));
    assert.match(fileCalls[0].url, /raw\.githubusercontent\.com/);
    assert.ok(!fileCalls[0].headers.Authorization);
  } finally {
    global.fetch = realFetch;
  }
});
