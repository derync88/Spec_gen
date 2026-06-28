import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useSpecs } from '../context/SpecsContext.jsx';

export function scoreColor(score) {
  if (score == null) return 'var(--muted)';
  if (score >= 75) return 'var(--good)';
  if (score >= 50) return 'var(--warn)';
  return 'var(--bad)';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { specs, refresh } = useSpecs();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const createBlank = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { spec } = await api.createSpec({ title, content: '' });
      await refresh();
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
      await refresh();
      navigate(`/specs/${spec.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
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
          Your saved specs are always in the sidebar on the left.
        </p>
      </div>

      {specs.length > 0 && (
        <p className="muted" style={{ marginTop: '1.2rem' }}>
          You have {specs.length} saved spec{specs.length === 1 ? '' : 's'} — pick one from the sidebar to pick up where you left off.
        </p>
      )}
    </div>
  );
}
