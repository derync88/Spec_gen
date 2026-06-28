/**
 * Minimal LCS-based line diff for highlighting what changed between two spec
 * versions (FR-17 / FR-2). Returns an array of { type, text } where type is
 * 'same' | 'added' | 'removed'.
 */
export function diffLines(oldText, newText) {
  const a = (oldText || '').split('\n');
  const b = (newText || '').split('\n');
  const n = a.length;
  const m = b.length;

  // LCS length table.
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'removed', text: a[i] }); i++; }
    else { out.push({ type: 'added', text: b[j] }); j++; }
  }
  while (i < n) { out.push({ type: 'removed', text: a[i] }); i++; }
  while (j < m) { out.push({ type: 'added', text: b[j] }); j++; }
  return out;
}
