import { scoreColor } from '../pages/Dashboard.jsx';

const SMART_KEYS = ['specific', 'measurable', 'achievable', 'relevant', 'testable'];

/** Suggestions that address a given coverage category (by category name or standard ref). */
function suggestionsForCategory(category, suggestions) {
  const c = (category || '').toLowerCase().trim();
  if (!c) return [];
  return suggestions.filter((s) => {
    const sc = (s.category || '').toLowerCase().trim();
    const ref = (s.standardRef || '').toLowerCase();
    return (sc && (sc === c || c.includes(sc) || sc.includes(c))) || ref.includes(c);
  });
}

/**
 * "How to reach 100" — turns the static coverage score into a ranked, actionable
 * plan derived from the reviewer's OWN rubric: each category that isn't fully
 * covered, biggest shortfall first, tied to the suggestions that close it.
 * `selection` reflects the author's saved accept/reject decisions, so the plan
 * shows live progress.
 *
 * It deliberately does NOT fake a projected score (the rubric weighting isn't a
 * simple sum) — it shows the gaps holding the score back and the concrete
 * acceptance/edit that resolves each, then points back to the review.
 */
export function PathToHundred({ result, selection = {} }) {
  const score = result.coverageScore;
  if (score == null) return null;

  const cats = Array.isArray(result.coverageByCategory) ? result.coverageByCategory : [];
  const suggestions = Array.isArray(result.suggestedRequirements) ? result.suggestedRequirements : [];
  const existing = Array.isArray(result.existingRequirements) ? result.existingRequirements : [];

  if (score >= 100) {
    return <p className="muted" style={{ margin: '0.7rem 0 0' }}>✓ Full coverage — nothing outstanding.</p>;
  }

  const actions = cats
    .filter((c) => c.status && c.status !== 'covered')
    .map((c) => {
      const matched = suggestionsForCategory(c.category, suggestions);
      const acceptedCount = matched.filter((s) => selection[s.id] === 'accepted').length;
      return {
        key: c.category,
        gain: Math.max(0, 100 - (Number(c.score) || 0)),
        status: c.status,
        score: c.score,
        notes: c.notes,
        matched,
        acceptedCount,
        done: matched.length > 0 && acceptedCount === matched.length,
      };
    })
    .sort((a, b) => b.gain - a.gain);

  // The author's own requirements with a rewrite that fixes weak SMART dimensions.
  const weak = existing.filter(
    (e) => e.improvedText && e.smart && SMART_KEYS.some((k) => e.smart[k] === false)
  );
  const weakAccepted = weak.filter((e) => selection[e.id] === 'accepted').length;
  const weakDone = weak.length > 0 && weakAccepted === weak.length;

  const totalActions = actions.length + (weak.length ? 1 : 0);
  const doneActions = actions.filter((a) => a.done).length + (weakDone ? 1 : 0);

  return (
    <div className="path-100">
      <div className="path-head">
        <strong>How to reach 100</strong>
        {totalActions > 0 && (
          <span className="muted"> · {doneActions}/{totalActions} recommended actions taken</span>
        )}
      </div>

      {totalActions === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>
          No specific gaps were flagged. Resolve the items in “Coverage gaps” below and re-run the
          review to move the score.
        </p>
      ) : (
        <ol className="path-list">
          {actions.map((a) => (
            <li key={a.key} className={a.done ? 'done' : ''}>
              <span className="path-gain" title="points this category is short of full coverage">+{a.gain}</span>
              <div className="path-body">
                <div>
                  <strong>{a.key}</strong>{' '}
                  <span className="muted small">({a.status}, {a.score}/100)</span>
                </div>
                {a.notes && <div className="muted small">{a.notes}</div>}
                <div className="path-do">
                  {a.matched.length > 0
                    ? `${a.done ? '✓ ' : ''}${a.acceptedCount}/${a.matched.length} matching suggestion${a.matched.length === 1 ? '' : 's'} accepted (${a.matched.map((s) => s.id).join(', ')}) — accept in the review tab`
                    : 'No suggestion for this yet — address it in your draft, then re-review.'}
                </div>
              </div>
            </li>
          ))}
          {weak.length > 0 && (
            <li className={weakDone ? 'done' : ''}>
              <span className="path-gain" title="strengthen what you already wrote">SMART</span>
              <div className="path-body">
                <div><strong>Tighten your own requirements</strong></div>
                <div className="path-do">
                  {weakDone ? '✓ ' : ''}Accept the rewrite for {weak.map((e) => e.id).join(', ')} to fix the weak SMART dimensions.
                </div>
              </div>
            </li>
          )}
        </ol>
      )}

      <p className="muted small" style={{ margin: '0.4rem 0 0' }}>
        Coverage is the reviewer’s rubric score. Accepting these closes the gaps it flagged; re-run
        the review after building to see the score move.
      </p>
    </div>
  );
}

/**
 * The full coverage report body: score + how-to-reach-100 + coverage by category
 * + gaps + ambiguities + traceability. Shown only in the standalone report
 * window (opened from the review tab), not inline in the review itself.
 */
export default function CoverageReportSections({ review, selection = {} }) {
  if (!review) return null;
  const r = review.result || {};

  return (
    <div>
      <div className="card">
        <div className="row">
          <div className="score-pill" style={{ background: '#11151d', color: scoreColor(r.coverageScore), fontSize: '1.1rem', minWidth: '4rem' }}>
            {r.coverageScore ?? '—'}
          </div>
          <div>
            <strong>Coverage score</strong>
            <div className="muted" style={{ fontSize: '0.82rem' }}>
              Reviewed by {review.provider}{review.model ? ` (${review.model})` : ''}
            </div>
          </div>
        </div>
        {r.summary && <p style={{ marginBottom: 0 }}>{r.summary}</p>}
        <PathToHundred result={r} selection={selection} />
      </div>

      {Array.isArray(r.coverageByCategory) && r.coverageByCategory.length > 0 && (
        <div className="card">
          <strong>Coverage by category</strong>
          <table style={{ marginTop: '0.6rem' }}>
            <thead>
              <tr><th>Category</th><th>Standard</th><th>Status</th><th>Score</th><th>What set this</th></tr>
            </thead>
            <tbody>
              {r.coverageByCategory.map((c, i) => (
                <tr key={i}>
                  <td>{c.category}</td>
                  <td className="muted">{c.standard}</td>
                  <td className={`status-${c.status}`}>{c.status}</td>
                  <td>{c.score}</td>
                  <td className="muted">{c.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {Array.isArray(r.gaps) && r.gaps.length > 0 && (
        <div className="card">
          <strong>Coverage gaps</strong>
          <ul>
            {r.gaps.map((g, i) => (
              <li key={i}>
                <span className={`status-${g.severity === 'high' ? 'missing' : g.severity === 'medium' ? 'partial' : 'covered'}`}>
                  [{g.severity}]
                </span>{' '}
                <strong>{g.area}</strong> — {g.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(r.ambiguities) && r.ambiguities.length > 0 && (
        <div className="card">
          <strong>Ambiguities to resolve</strong>
          <ul>
            {r.ambiguities.map((a, i) => (
              <li key={i}><em>“{a.text}”</em> — {a.problem} → <span className="muted">{a.suggestion}</span></li>
            ))}
          </ul>
        </div>
      )}

      {r.traceability && Array.isArray(r.traceability.orphans) && r.traceability.orphans.length > 0 && (
        <div className="card">
          <strong>Traceability &amp; orphan detection</strong>
          <ul>
            {r.traceability.orphans.map((o, i) => (
              <li key={i}><strong>{o.item}</strong> — {o.issue}</li>
            ))}
          </ul>
          {r.traceability.notes && <p className="muted" style={{ marginBottom: 0 }}>{r.traceability.notes}</p>}
        </div>
      )}
    </div>
  );
}
