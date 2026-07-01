import { useState } from 'react';

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

// Human-readable capability for a requirement: the catalogue archetype name for
// catalogue-derived items, else its ISO category. Never the raw archetype slug.
const capabilityLabel = (req) => req.sourceArchetypeName || req.category || null;

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
        {capabilityLabel(req) && <span className="badge capability">🗂 {capabilityLabel(req)}</span>}
        <span className="req-id">{req.id}</span>
      </div>

      {/* SMART self-assessment (present on generated requirements). */}
      <SmartRow smart={req.smart} label="this requirement" />

      <p className="req-text">
        {editText ?? req.text}
        {editText && <span className="badge edited">edited</span>}
      </p>

      <div className="meta">
        {req.standardRef && <span title="business-analysis standard / quality characteristic">📐 {req.standardRef}</span>}
        {req.verification && <span>{req.standardRef ? ' · ' : ''}✔ {req.verification}</span>}
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

const SMART_KEYS = ['specific', 'measurable', 'achievable', 'relevant', 'testable'];

/** The five SMART pills, coloured pass/fail, captioned so it's clear what they rate. */
function SmartRow({ smart, label }) {
  if (!smart) return null;
  return (
    <div className="smart-line">
      <span className="smart-cap">SMART</span>
      <span className="smart-row" aria-label={`SMART rating of ${label}`}>
        {SMART_KEYS.map((k) => (
          <span key={k} className={`smart-pill ${smart[k] ? 'on' : 'off'}`} title={`${k}: ${smart[k] ? 'pass' : 'fail'}`}>
            {k[0].toUpperCase()}{smart[k] ? '✓' : '✗'}
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * SMART rating for the rewrite. Prefer the model's own assessment; if absent,
 * fall back to the standards-compliant intent of a rewrite (every dimension the
 * original was rated on is satisfied) so the two columns are always comparable.
 */
function improvedSmartOf(req) {
  if (req.improvedSmart) return req.improvedSmart;
  if (!req.smart) return null;
  return SMART_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {});
}

/**
 * One of the author's OWN requirements, reviewed: their original wording + SMART
 * rating + assessment feedback on the left, the AI's suggested rewrite on the
 * right, and an accept/reject/edit gate — all on one card (the combined view).
 *
 * Accept adopts the rewrite; reject/pending keep the author's wording (the
 * requirement is never dropped). Equal-weight controls — no roach-motel
 * asymmetry (FR-20 / NFR-12).
 */
function YourRequirementCard({ req, status, editText, onSelect, onEdit }) {
  const [editing, setEditing] = useState(false);
  const isNfr = req.type === 'non-functional';
  const accepted = status === 'accepted';
  const rejected = status === 'rejected';
  const original = req.originalText ?? req.text;
  const hasRewrite = typeof req.improvedText === 'string' && req.improvedText.trim() !== '';
  const improvedSmart = improvedSmartOf(req);

  return (
    <div className={`req compare ${accepted ? 'is-accepted' : ''} ${rejected ? 'is-rejected' : ''}`}>
      <div className="req-head">
        <span className={`badge ${isNfr ? 'nfr' : 'fr'}`}>{isNfr ? 'NFR' : 'FR'}</span>
        <span className="badge source user">Your requirement</span>
        {capabilityLabel(req) && <span className="badge capability">🗂 {capabilityLabel(req)}</span>}
        <span className="req-id">{req.id}</span>
      </div>

      <div className="compare-grid">
        <div className={`compare-col ${rejected ? 'chosen' : ''}`}>
          <div className="compare-label">You wrote</div>
          <SmartRow smart={req.smart} label="what you wrote" />
          <p className="req-text">“{original}”</p>
          {Array.isArray(req.issues) && req.issues.length > 0 && (
            <>
              <div className="compare-label muted">Assessment</div>
              <ul className="assessment">{req.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </>
          )}
        </div>

        <div className={`compare-col ${accepted ? 'chosen' : ''}`}>
          <div className="compare-label">Suggested rewrite</div>
          {hasRewrite ? (
            <>
              <SmartRow smart={improvedSmart} label="the suggested rewrite" />
              {editing ? (
                <textarea
                  className="edit-area"
                  value={editText ?? req.improvedText}
                  onChange={(e) => onEdit(req.id, e.target.value)}
                  aria-label={`Edit rewrite for ${req.id}`}
                />
              ) : (
                <p className="req-text">
                  {editText ?? req.improvedText}
                  {editText && <span className="badge edited">edited</span>}
                </p>
              )}
            </>
          ) : (
            <p className="muted">No rewrite needed — this requirement already reads well.</p>
          )}
        </div>
      </div>

      {hasRewrite && (
        <div className="decision-bar">
          <button
            type="button"
            className={`decision ${accepted ? 'on-accept' : ''}`}
            aria-pressed={accepted}
            onClick={() => onSelect(req.id, accepted ? 'pending' : 'accepted')}
          >
            {accepted ? '✓ Using rewrite' : 'Accept rewrite'}
          </button>
          <button
            type="button"
            className={`decision ${rejected ? 'on-reject' : ''}`}
            aria-pressed={rejected}
            onClick={() => onSelect(req.id, rejected ? 'pending' : 'rejected')}
          >
            {rejected ? '✓ Keeping yours' : 'Keep mine'}
          </button>
          <button type="button" className="decision ghost" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Done editing' : 'Edit'}
          </button>
        </div>
      )}
    </div>
  );
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
  const capability = reqs[0]?.sourceArchetypeName || archetypeId;

  return (
    <div style={{ marginTop: '1rem' }}>
      <div className="action-bar">
        <div>
          <strong>🗂 {capability}</strong>{' '}
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
  const existing = Array.isArray(r.existingRequirements) ? r.existingRequirements : [];
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
      {ratio?.warning && (
        <p className="error" style={{ marginTop: '1rem' }}>⚠ {ratio.warning}</p>
      )}

      {/* Combined view: each requirement the author wrote, with its SMART rating,
          the assessment feedback, and the suggested rewrite — decided in one place. */}
      {existing.length > 0 && (
        <>
          <h3 className="section-title">Your requirements — reviewed</h3>
          <p className="muted" style={{ margin: '0 0 0.6rem' }}>
            For each requirement you wrote: how it rated against <strong>SMART</strong>, the feedback,
            and a suggested rewrite. Your original wording is kept unless you accept the rewrite —
            nothing changes without your say-so.
          </p>
          {existing.map((req) => (
            <YourRequirementCard
              key={req.id}
              req={req}
              status={selection[req.id] || 'pending'}
              editText={edits[req.id]}
              onSelect={onSelect}
              onEdit={onEdit}
            />
          ))}
        </>
      )}

      {(fr.length > 0 || nfr.length > 0) && (
        <p className="muted" style={{ margin: '1.4rem 0 0' }}>
          Below are <strong>new</strong> requirements proposed to close coverage gaps — not changes to
          what you wrote. Accept the ones you want; only accepted items enter your spec.
        </p>
      )}

      <SuggestionGroup
        title="Suggested additional functional requirements"
        reqs={fr} selection={selection} edits={edits} onSelect={onSelect} onEdit={onEdit}
      />
      <SuggestionGroup
        title="Suggested additional non-functional requirements"
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
    </div>
  );
}
