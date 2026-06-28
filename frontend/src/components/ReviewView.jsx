import { scoreColor } from '../pages/Dashboard.jsx';

function ReqCard({ req }) {
  const isNfr = req.type === 'non-functional';
  return (
    <div className="req">
      <h4>
        <span className={`badge ${isNfr ? 'nfr' : 'fr'}`}>{isNfr ? 'NFR' : 'FR'}</span>
        {req.priority && <span className={`badge ${req.priority}`}>{req.priority}</span>}
        {req.id} — {req.text}
      </h4>
      <div className="meta">
        {req.category && <span>{req.category}</span>}
        {req.standardRef && <span> · {req.standardRef}</span>}
        {req.istqbTechnique && <span> · 🧪 {req.istqbTechnique}</span>}
      </div>
      {req.rationale && <p style={{ margin: '0.4rem 0' }}>{req.rationale}</p>}
      {Array.isArray(req.acceptanceCriteria) && req.acceptanceCriteria.length > 0 && (
        <>
          <div className="meta">Acceptance criteria:</div>
          <ul>{req.acceptanceCriteria.map((ac, i) => <li key={i}>{ac}</li>)}</ul>
        </>
      )}
    </div>
  );
}

export default function ReviewView({ review }) {
  if (!review) return null;
  const r = review.result || {};
  const suggested = Array.isArray(r.suggestedRequirements) ? r.suggestedRequirements : [];
  const fr = suggested.filter((s) => s.type !== 'non-functional');
  const nfr = suggested.filter((s) => s.type === 'non-functional');

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
      </div>

      {Array.isArray(r.coverageByCategory) && r.coverageByCategory.length > 0 && (
        <div className="card">
          <strong>Coverage by category</strong>
          <table style={{ marginTop: '0.6rem' }}>
            <thead>
              <tr><th>Category</th><th>Standard</th><th>Status</th><th>Score</th><th>Notes</th></tr>
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

      {fr.length > 0 && (
        <>
          <h3 className="section-title">Suggested functional requirements ({fr.length})</h3>
          {fr.map((req, i) => <ReqCard key={i} req={req} />)}
        </>
      )}

      {nfr.length > 0 && (
        <>
          <h3 className="section-title">Suggested non-functional requirements ({nfr.length})</h3>
          {nfr.map((req, i) => <ReqCard key={i} req={req} />)}
        </>
      )}

      {Array.isArray(r.existingRequirements) && r.existingRequirements.length > 0 && (
        <>
          <h3 className="section-title">Assessment of your existing requirements</h3>
          {r.existingRequirements.map((req, i) => (
            <div className="req" key={i}>
              <h4>{req.id} <span className="muted">({req.type})</span></h4>
              {req.text && <p className="muted" style={{ margin: '0.2rem 0' }}>“{req.text}”</p>}
              {req.smart && (
                <div className="meta">
                  SMART:{' '}
                  {['specific', 'measurable', 'achievable', 'relevant', 'testable'].map((k) => (
                    <span key={k} style={{ color: req.smart[k] ? 'var(--good)' : 'var(--bad)' }}>
                      {k[0].toUpperCase()}{req.smart[k] ? '✓' : '✗'}{' '}
                    </span>
                  ))}
                </div>
              )}
              {Array.isArray(req.issues) && req.issues.length > 0 && (
                <ul>{req.issues.map((x, j) => <li key={j}>{x}</li>)}</ul>
              )}
              {req.improvedText && <p style={{ margin: '0.4rem 0 0' }}><strong>Improved:</strong> {req.improvedText}</p>}
            </div>
          ))}
        </>
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

      {r.traceability && (Array.isArray(r.traceability.orphans) ? r.traceability.orphans.length > 0 : false) && (
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
