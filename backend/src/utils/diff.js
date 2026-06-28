/**
 * Lightweight, dependency-free change summary between two Markdown spec
 * versions (FR-17). Counts requirements added, removed, and modified.
 *
 * Strategy: requirement-bearing lines are keyed by their stable ID
 * (e.g. "FR-1", "NFR-2") where present, so a reworded requirement that keeps
 * its ID counts as "modified" rather than one add + one remove. Lines with no
 * ID fall back to exact-match set difference.
 */

const ID_RE = /\b((?:FR|NFR)-[A-Za-z0-9-]+)\b/;

function meaningfulLines(md) {
  return (md || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l !== '---');
}

/** @returns {{added:number, removed:number, modified:number}} */
export function computeChangeSummary(oldMd, newMd) {
  const oldLines = meaningfulLines(oldMd);
  const newLines = meaningfulLines(newMd);

  const oldById = new Map();
  const newById = new Map();
  const oldPlain = [];
  const newPlain = [];

  for (const l of oldLines) {
    const m = l.match(ID_RE);
    if (m) oldById.set(m[1], l);
    else oldPlain.push(l);
  }
  for (const l of newLines) {
    const m = l.match(ID_RE);
    if (m) newById.set(m[1], l);
    else newPlain.push(l);
  }

  let added = 0;
  let removed = 0;
  let modified = 0;

  // ID-keyed requirements: present in both = modified-if-changed, else add/remove.
  for (const [id, text] of newById) {
    if (!oldById.has(id)) added += 1;
    else if (oldById.get(id) !== text) modified += 1;
  }
  for (const id of oldById.keys()) {
    if (!newById.has(id)) removed += 1;
  }

  // Plain lines: exact-match multiset difference.
  const oldCounts = tally(oldPlain);
  const newCounts = tally(newPlain);
  for (const [line, n] of newCounts) {
    const extra = n - (oldCounts.get(line) || 0);
    if (extra > 0) added += extra;
  }
  for (const [line, n] of oldCounts) {
    const gone = n - (newCounts.get(line) || 0);
    if (gone > 0) removed += gone;
  }

  return { added, removed, modified };
}

function tally(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return m;
}
