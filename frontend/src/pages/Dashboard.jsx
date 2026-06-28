import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

export function scoreColor(score) {
  if (score == null) return 'var(--muted)';
  if (score >= 75) return 'var(--good)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [specs, setSpecs] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const { specs } = await api.listSpecs();
      setSpecs(specs);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const createBlank = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { spec } = await api.createSpec({ title, content: '' });
      navigate(`/specs/${spec.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { spec } = await api.createSpecFromFile(form);
      navigate(`/specs/${spec.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this spec?')) return;
    await api.deleteSpec(id);
    load();
  };

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>New specification</h2>
        <form onSubmit={createBlank} className="row">
          <input
            placeholder="Spec title, e.g. “Invoice export feature”"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: 1, minWidth: '220px' }}
          />
          <button className="primary" type="submit" disabled={busy}>Create blank</button>
          <label className="badge" style={{ cursor: 'pointer', padding: '0.5rem 0.9rem', fontSize: '0.9rem' }}>
            Upload .md / .txt
            <input type="file" accept=".md,.txt,.markdown,text/plain" hidden onChange={uploadFile} />
          </label>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="muted" style={{ marginBottom: 0 }}>
          Write or paste draft requirements, then run an AI review for full functional &amp; non-functional coverage.
        </p>
      </div>

      <h3 className="section-title">Your specs</h3>
      {specs.length === 0 && <p className="muted">No specs yet — create one above.</p>}
      {specs.map((s) => (
        <div key={s.id} className="spec-list-item" onClick={() => navigate(`/specs/${s.id}`)} style={{ cursor: 'pointer' }}>
          <div>
            <strong>{s.title}</strong>
            <div className="muted" style={{ fontSize: '0.82rem' }}>
              Updated {new Date(s.updated_at).toLocaleString()}
            </div>
          </div>
          <div className="row">
            <span className="score-pill" style={{ background: '#11151d', color: scoreColor(s.latest_score) }}>
              {s.latest_score == null ? '—' : `${s.latest_score}`}
            </span>
            <button onClick={(e) => remove(s.id, e)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
