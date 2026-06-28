import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ReviewView from '../components/ReviewView.jsx';

export default function SpecEditor() {
  const { id } = useParams();
  const [spec, setSpec] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [review, setReview] = useState(null);
  const [rewrittenMd, setRewrittenMd] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [tab, setTab] = useState('edit');

  useEffect(() => {
    (async () => {
      try {
        const { spec } = await api.getSpec(id);
        setSpec(spec);
        setTitle(spec.title);
        setContent(spec.content);
        if (spec.latestReview) {
          setReview(spec.latestReview);
          setRewrittenMd(spec.latestReview.rewritten_markdown || '');
          setTab('review');
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  const save = async () => {
    setSaving(true);
    setError('');
    setStatus('');
    try {
      await api.updateSpec(id, { title, content });
      setStatus('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runReview = async () => {
    setReviewing(true);
    setError('');
    setStatus('');
    try {
      await api.updateSpec(id, { title, content }); // save first
      const { review } = await api.reviewSpec(id);
      setReview(review);
      setRewrittenMd(review.rewritten_markdown || '');
      setTab('review');
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const runRewrite = async () => {
    setRewriting(true);
    setError('');
    setStatus('');
    try {
      const { rewrite } = await api.rewriteSpec(id);
      setRewrittenMd(rewrite.markdown);
      setTab('spec');
    } catch (err) {
      setError(err.message);
    } finally {
      setRewriting(false);
    }
  };

  const uploadReplace = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setStatus('File loaded into editor — save or review when ready.');
  };

  const exportReview = async () => {
    try { await api.downloadExport(id, title); } catch (err) { setError(err.message); }
  };
  const exportSpec = async () => {
    try { await api.downloadSpec(id, title); } catch (err) { setError(err.message); }
  };

  if (!spec && !error) return <div className="container"><p className="muted">Loading…</p></div>;

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: '1rem' }}>
        <Link to="/">← All specs</Link>
        <div className="spacer" />
        <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button className="primary" onClick={runReview} disabled={reviewing}>
          {reviewing ? 'Reviewing…' : '✨ Run AI review'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="muted">{status}</p>}

      <div className="tabs">
        <button className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>Draft</button>
        <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')} disabled={!review}>
          Review {review?.result?.coverageScore != null ? `(${review.result.coverageScore})` : ''}
        </button>
        <button className={tab === 'spec' ? 'active' : ''} onClick={() => setTab('spec')} disabled={!rewrittenMd}>
          Updated spec
        </button>
      </div>

      {tab === 'edit' && (
        <div className="card">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>
              Draft requirements{' '}
              <label style={{ display: 'inline', cursor: 'pointer', color: 'var(--accent)' }}>
                (or upload a file
                <input type="file" accept=".md,.txt,.markdown,text/plain" hidden onChange={uploadReplace} />
                )
              </label>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your draft functional/non-functional requirements here…"
            />
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Tip: even rough bullet points work — the reviewer will extract, assess, and expand them
            using ISTQB, ISO 29148, ISO 25010, INCOSE GtWR, Volere, IREB &amp; BABOK.
          </p>
        </div>
      )}

      {tab === 'review' && review && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
            <div>
              <strong>Happy with the review?</strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                Generate an updated, structured spec that folds these suggestions in.
              </div>
            </div>
            <div className="spacer" />
            <button onClick={exportReview}>⬇ Export review</button>
            <button className="primary" onClick={runRewrite} disabled={rewriting}>
              {rewriting ? 'Updating…' : '📝 Update spec with review feedback'}
            </button>
          </div>
          <ReviewView review={review} />
        </>
      )}
      {tab === 'review' && !review && <p className="muted">Run a review to see results.</p>}

      {tab === 'spec' && rewrittenMd && (
        <>
          <div className="row" style={{ marginBottom: '0.8rem' }}>
            <strong>Updated specification</strong>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Structured: goal · scope · user-facing outcomes (FR/NFR) · success criteria
            </span>
            <div className="spacer" />
            <button onClick={runRewrite} disabled={rewriting}>
              {rewriting ? 'Regenerating…' : '↻ Regenerate'}
            </button>
            <button className="primary" onClick={exportSpec}>⬇ Export spec .md</button>
          </div>
          <div className="card">
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.88rem' }}>
              {rewrittenMd}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}
