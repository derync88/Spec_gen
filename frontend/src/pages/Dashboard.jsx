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

  const create = async (mode) => {
    if (!title.trim()) { setError('Give your spec a title first.'); return; }
    setBusy(true);
    setError('');
    try {
      const { spec } = await api.createSpec({ title, content: '', mode });
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

  const submitTitle = (e) => { e.preventDefault(); };

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>New specification</h2>
        <form onSubmit={submitTitle} className="field">
          <label>Title</label>
          <input
            placeholder="e.g. “Invoice export feature”"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Spec title"
          />
        </form>
        {error && <p className="error">{error}</p>}

        <div className="choice-grid">
          <div className="choice-card">
            <div className="choice-icon" aria-hidden="true">✨</div>
            <strong>Generate from an idea</strong>
            <p className="muted">
              Describe what you want to achieve and let the AI <em>author</em> the full functional &amp;
              non-functional requirements — each rated against SMART, categorised, and tied to the
              business-analysis standard that produced it.
            </p>
            <button className="primary" disabled={busy} onClick={() => create('generate')}>
              ✨ Generate from an idea →
            </button>
          </div>

          <div className="choice-card">
            <div className="choice-icon" aria-hidden="true">📝</div>
            <strong>Review my draft</strong>
            <p className="muted">
              Write or paste your own draft requirements and run an AI review for coverage, a SMART
              assessment, and suggested improvements you accept or reject.
            </p>
            <button disabled={busy} onClick={() => create('review')}>📝 Review my draft →</button>
            <label className="upload-link">
              or upload a .md / .txt draft
              <input type="file" accept=".md,.txt,.markdown,text/plain" hidden onChange={uploadFile} />
            </label>
          </div>
        </div>
      </div>

      {specs.length > 0 && (
        <p className="muted" style={{ marginTop: '1.2rem' }}>
          You have {specs.length} saved spec{specs.length === 1 ? '' : 's'} — pick one from the sidebar to pick up where you left off.
        </p>
      )}
    </div>
  );
}
