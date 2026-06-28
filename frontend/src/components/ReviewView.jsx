import { useState } from 'react';
import { scoreColor } from '../pages/Dashboard.jsx';

const PRIORITY_ORDER = { must: 0, should: 1, could: 2, wont: 3 };
const INITIAL_VISIBLE = 4;

// Provenance labels (FR-3). Values beyond model-suggested are reserved for the
// catalogue milestone (selected/inferred/injected) so the gate is already
// provenance-aware when those land.
const SOURCE_LABELS = {
  'model-suggested': 'AI-suggested',
  user: 'Your requirement',
  selected: 'From catalogue',
  inferred: 'Inferred',
  injected: 'Injected default',
};

// Prescription → badge class (reuses MoSCoW colours): constraint binds, advisory guides.
const PRESCRIPTION_CLASS = { constraint: 'must', advisory: 'should', 'silent-default': 'could' };

/** A single suggested requirement with an accept/reject/edit gate (FR-1, FR-3, FR-20). */
function SuggestionCard({ req, status, editText, onSelect, onEdit }) {
  const [editing, setEditing] = useState(false);
  const isNfr = req.type === 'non-functional';
  const accepted = status === 'accepted';
  const rejected = status === 'rejected';

  return (
    <div className={`req suggestion ${accepted ? 'is-accepted' : ''} ${rejected ? 'is-rejected' : ''}`}>
      <div className="req-head">
        <span className={`badge ${isNfr ? 'nfr' : 'fr'}`}>{isNfr ? 'NFR' : 'FR'}</span>
        {req.priority && <span className={`badge ${req.priority}`}>{req.priority}</span>}
        {req.prescription && (
          <span className={`badge ${PRESCRIPTION_CLASS[req.prescription] || 'could'}`}>{req.prescription}</span>
        )}
        <span className="badge source">{SOURCE_LABELS[req.source] || SOURCE_LABELS['model-suggested']}</span>
        {req.sourceArchetypeId && <span className="badge">{req.sourceArchetypeId}</span>}
        <span className="req-id">{req.id}</span>
      </div>

      <p className="req-text">
        {editText ?? req.text}
        {editText && <span className="badge edited">edited</span>}
      </p>

      <div className="meta">
        {req.category && <span>{req.category}</span>}
        {req.standardRef && <span> · {req.standardRef}</span>}
        {req.verification && <span> · ✔ {req.verification}</span>}
        {req.istqbTechnique && <span> · 🧪 {req.istqbTechnique}</span>}
      </div>

      {req.justification && <p className="why"><strong>Why:</strong> {req.justification}</p>}
      {req.rationale && <p className="rationale">{req.rationale}</p>}

      {Array.isArray(req.acceptanceCriteria) && req.acceptanceCriteria.length > 0 && (
        <>
          <div className="meta">Acceptance criteria:</div>
          <ul>
            {req.acceptanceCriteria.map((ac, i) => (
              <li key={i}>{renderAc(ac)}</li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <div className="field" style={{ marginTop: '0.6rem' }}>
          <label>Edit requirement text</label>
          <textarea
            className="edit-area"
            value={editText ?? req.text}
            onChange={(e) => onEdit(req.id, e.target.value)}
          />
        </div>
      )}

      {/* Equal-weight, neutral controls — no roach-motel asymmetry (FR-20 / NFR-12). */}
      <div className="decision-bar">
        <button
          type="button"
          className={`decision ${accepted ? 'on-accept' : ''}`}
          aria-pressed={accepted}
          onClick={() => onSelect(req.id, accepted ? 'pending' : 'accepted')}
        >
          {accepted ? '✓ Accepted' : 'Accept'}
        </button>
        <button
          type="button"
          className={`decision ${rejected ? 'on-reject' : ''}`}
          aria-pressed={rejected}
          onClick={() => onSelect(req.id, rejected ? 'pending' : 'rejected')}
        >
          {rejected ? 'Rejected' : 'Reject'}
        </button>
        <button type="button" className="decision ghost" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done editing' : 'Edit'}
        </button>
      </div>
    </div>
  );
}

function renderAc(ac) {
  if (typeof ac === 'string' && ac.includes('VALUE NEEDED')) {
    const segs = ac.split(/(VALUE NEEDED)/g);
    return segs.map((s, i) =>
      s === 'VALUE NEEDED'
        ? <span key={i} className="token-needed">VALUE NEEDED</span>
        : <span key={i}>{s}</span>
    );
  }
  return ac;
}

/** A collapsible, priority-ordered group of suggestions (FR-19 / FR-23). */
function SuggestionGroup({ title, reqs, selection, edits, onSelect, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  if (!reqs.length) return null;

  const sorted = [...reqs].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  );
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_VISIBLE);
  const hidden = sorted.length - visible.length;

  return (
    <>
      <h3 className="section-title">{title} ({reqs.length})</h3>
      {visible.map((req) => (
        <SuggestionCard
          key={req.id}
          req={req}
          status={selection[req.id] || 'pending'}
          editText={edits[req.id]}
          onSelect={onSelect}
          onEdit={onEdit}
        />
      ))}
      {hidden > 0 && (
        <button type="button" className="ghost show-more" onClick={() => setExpanded(true)}>
          Show {hidden} more {title.toLowerCase()}
        </button>
      )}
    </>
  );
}

/**
 * Catalogue-derived suggestions grouped by archetype, with equal-weight
 * accept-all / reject-all (FR-C6 / FR-C23 mental-accounting). Each remains
 * individually overridable via its own card controls.
 */
function ArchetypeGroup({ archetypeId, reqs, selection, edits, onSelect, onEdit }) {
  const ids = reqs.map((req) => req.id);
  const allAccepted = ids.every((id) => selection[id] === 'accepted');
  const allRejected = ids.every((id) => selection[id] === 'rejected');
  const bulk = (status) => ids.forEach((id) => onSelect(id, status));

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="action-bar">
        <div>
          <strong>{archetypeId}</strong>{' '}
          <span className="muted" style={{ fontSize: '0.82rem' }}>· {reqs.length} requirement{reqs.length === 1 ? '' : 's'}</span>
        </div>
        <div className="spacer" />
        <button type="button" className={`decision ${allAccepted ? 'on-accept' : ''}`} onClick={() => bulk('accepted')}>
          Accept all
        </button>
        <button type="button" className={`decision ${allRejected ? 'on-reject' : ''}`} onClick={() => bulk('rejected')}>
          Reject all
        </button>
      </div>
      {reqs.map((req) => (
        <SuggestionCard
          key={req.id}
          req={req}
          status={selection[req.id] || 'pending'}
          editText={edits[req.id]}
          onSelect={onSelect}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}

export default function ReviewView({ review, selection, edits, onSelect, onEdit }) {
  if (!review) return null;
  const r = review.result || {};
  const suggested = Array.isArray(r.suggestedRequirements) ? r.suggestedRequirements : [];
  // Split catalogue-derived (have an archetype) from model-only suggestions.
  const catalogue = suggested.filter((s) => s.sourceArchetypeId);
  const modelOnly = suggested.filter((s) => !s.sourceArchetypeId);
  const fr = modelOnly.filter((s) => s.type !== 'non-functional');
  const nfr = modelOnly.filter((s) => s.type === 'non-functional');
  const byArchetype = catalogue.reduce((acc, s) => {
    (acc[s.sourceArchetypeId] = acc[s.sourceArchetypeId] || []).push(s);
    return acc;
  }, {});
  const ratio = r.constraintRatio;
  const probes = Array.isArray(r.catalogueProbes) ? r.catalogueProbes : [];

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

      {(fr.length > 0 || nfr.length > 0) && (
        <p className="muted" style={{ margin: '1rem 0 0' }}>
          These are <strong>proposals</strong>. Accept the ones you want — only accepted items
          enter your spec. Nothing is added without your say-so.
        </p>
      )}

      {ratio?.warning && (
        <p className="error" style={{ marginTop: '1rem' }}>⚠ {ratio.warning}</p>
      )}

      <SuggestionGroup
        title="Suggested functional requirements"
        reqs={fr} selection={selection} edits={edits} onSelect={onSelect} onEdit={onEdit}
      />
      <SuggestionGroup
        title="Suggested non-functional requirements"
        reqs={nfr} selection={selection} edits={edits} onSelect={onSelect} onEdit={onEdit}
      />

      {Object.keys(byArchetype).length > 0 && (
        <>
          <h3 className="section-title">From catalogue archetypes</h3>
          <p className="muted" style={{ margin: 0 }}>
            Composed from the archetypes you confirmed. Accept per archetype or per requirement —
            nothing enters your spec until you accept it here.
          </p>
          {Object.entries(byArchetype).map(([archetypeId, reqs]) => (
            <ArchetypeGroup
              key={archetypeId}
              archetypeId={archetypeId}
              reqs={reqs}
              selection={selection}
              edits={edits}
              onSelect={onSelect}
              onEdit={onEdit}
            />
          ))}
        </>
      )}

      {probes.length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <strong>Be cautious of (archetype gap probes)</strong>
          <ul>
            {probes.map((p, i) => (
              <li key={i}>
                {p.prescription === 'constraint' && <span className="status-missing">[constraint] </span>}
                {p.text} <span className="muted">— {p.archetypeName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(r.assumptions) && r.assumptions.length > 0 && (
        <div className="card">
          <strong>Assumptions made</strong>
          <ul>
            {r.assumptions.map((a, i) => <li key={i}>{a.text || (typeof a === 'string' ? a : '')}</li>)}
          </ul>
        </div>
      )}

      {Array.isArray(r.existingRequirements) && r.existingRequirements.length > 0 && (
        <>
          <h3 className="section-title">Assessment of your existing requirements</h3>
          {r.existingRequirements.map((req, i) => (
            <div className="req" key={i}>
              <div className="req-head">
                <span className="badge source user">Your requirement</span>
                <span className="req-id">{req.id}</span>
                <span className="muted">({req.type})</span>
              </div>
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
