import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

// Mode B (FR-C3/FR-C4): the user writes free-text requirements, classifies them
// against the catalogue, and confirms/rejects each archetype match. Nothing is
// applied to the spec here — confirmed matches pre-populate the accept/reject
// gate in the review step (NFR-C3 / no silent injection).

const STATUS_LABEL = { confirmed: 'Confirmed', pending: 'Needs confirmation', rejected: 'Rejected' };
const PRESCRIPTION_LABEL = { constraint: 'constraint', advisory: 'advisory', 'silent-default': 'silent-default' };

function MatchRow({ match, status, onDecide }) {
  const confirmed = status === 'confirmed';
  const rejected = status === 'rejected';
  return (
    <div className={`req suggestion ${confirmed ? 'is-accepted' : ''} ${rejected ? 'is-rejected' : ''}`}>
      <div className="req-head">
        <span className="badge source">{match.name}</span>
        <span className="badge">{match.layer}</span>
        {match.defaultPrescription && (
          <span className={`badge ${match.defaultPrescription === 'constraint' ? 'must' : 'could'}`}>
            {PRESCRIPTION_LABEL[match.defaultPrescription] || match.defaultPrescription}
          </span>
        )}
        <span className="req-id">{Math.round(match.confidence * 100)}% match</span>
        <span className="muted" style={{ fontSize: '0.8rem', marginLeft: '0.4rem' }}>
          {STATUS_LABEL[status] || STATUS_LABEL.pending}
        </span>
      </div>
      {match.pulls?.length > 0 && (
        <p className="muted" style={{ margin: '0.2rem 0', fontSize: '0.8rem' }}>
          Pulls in: {match.pulls.join(', ')}
        </p>
      )}
      {/* Equal-weight controls — no roach-motel asymmetry (FR-C6.2 / FR-20). */}
      <div className="decision-bar">
        <button
          type="button"
          className={`decision ${confirmed ? 'on-accept' : ''}`}
          aria-pressed={confirmed}
          onClick={() => onDecide(match.archetypeId, 'confirmed')}
        >
          {confirmed ? '✓ Confirmed' : 'Confirm'}
        </button>
        <button
          type="button"
          className={`decision ${rejected ? 'on-reject' : ''}`}
          aria-pressed={rejected}
          onClick={() => onDecide(match.archetypeId, 'rejected')}
        >
          {rejected ? 'Rejected' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

export default function ClassifyView({ specId, initialText = '' }) {
  const [text, setText] = useState(initialText);
  const [results, setResults] = useState([]);
  const [bespoke, setBespoke] = useState([]);
  const [statusById, setStatusById] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { archetypes } = await api.getSpecArchetypes(specId);
        const s = {};
        archetypes.forEach((a) => { s[a.archetype_id] = a.status; });
        setStatusById(s);
      } catch { /* non-fatal */ }
    })();
  }, [specId]);

  const classify = async () => {
    const reqs = text.split('\n').map((t) => t.trim()).filter(Boolean);
    if (!reqs.length) { setError('Enter at least one requirement (one per line).'); return; }
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await api.classifySpec(specId, { requirements: reqs });
      setResults(res.results || []);
      setBespoke(res.bespoke || []);
      const s = {};
      (res.results || []).forEach((r) => r.matches.forEach((m) => { s[m.archetypeId] = m.status; }));
      setStatusById((prev) => ({ ...prev, ...s }));
      setInfo(`Classified ${reqs.length} requirement${reqs.length === 1 ? '' : 's'} via ${res.provider}. Confirmed matches will pre-populate the review gate.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const decide = async (archetypeId, status) => {
    const next = statusById[archetypeId] === status ? 'pending' : status;
    setStatusById((prev) => ({ ...prev, [archetypeId]: next }));
    try {
      await api.decideArchetype(specId, archetypeId, next);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card">
      <strong>Describe your platform in plain requirements</strong>
      <p className="muted" style={{ marginTop: '0.3rem' }}>
        One requirement per line. Each is auto-matched to catalogue archetypes — you confirm or
        reject each match. Nothing enters your spec until you accept it in the review step.
      </p>
      <textarea
        style={{ minHeight: 140 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'e.g.\nUsers can sign in and reset their password\nAdmins manage user accounts\nProviders list services and buyers enquire'}
      />
      <div className="row" style={{ marginTop: '0.6rem' }}>
        <div className="spacer" />
        <button className="primary" onClick={classify} disabled={busy}>
          {busy ? 'Classifying…' : '🧭 Classify against catalogue'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {info && <p className="muted">{info}</p>}

      {results.map((r) => (
        <div key={r.requirementId} style={{ marginTop: '1rem' }}>
          <div className="section-title">“{r.text}”</div>
          {r.unmatched ? (
            <p className="muted">
              No catalogue archetype matched — treated as <strong>bespoke</strong> (Low checkability;
              it goes through the standard review path with extra detail).
            </p>
          ) : (
            r.matches.map((m) => (
              <MatchRow
                key={m.archetypeId}
                match={m}
                status={statusById[m.archetypeId] || m.status}
                onDecide={decide}
              />
            ))
          )}
        </div>
      ))}

      {bespoke.length > 0 && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          {bespoke.length} requirement{bespoke.length === 1 ? '' : 's'} flagged bespoke (no archetype fit).
        </p>
      )}
    </div>
  );
}
