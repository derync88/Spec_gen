import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useSpecs } from '../context/SpecsContext.jsx';
import ReviewView from '../components/ReviewView.jsx';
import ClassifyView from '../components/ClassifyView.jsx';
import RequirementsEditor from '../components/RequirementsEditor.jsx';
import { Markdown } from '../lib/markdown.jsx';
import { diffLines } from '../lib/linediff.js';

export default function SpecEditor() {
  const { id } = useParams();
  const { refresh: refreshSidebar } = useSpecs();
  const [spec, setSpec] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');

  // Project setup: new project (objective) vs existing project (GitHub repo).
  const [projectType, setProjectType] = useState('new');
  const [objective, setObjective] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoAnalysis, setRepoAnalysis] = useState(null);

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});

  const [review, setReview] = useState(null);
  const [selection, setSelection] = useState({}); // id -> 'accepted' | 'rejected'
  const [edits, setEdits] = useState({});         // id -> edited text

  const [rewrittenMd, setRewrittenMd] = useState('');
  const [versions, setVersions] = useState([]);
  const [showDiff, setShowDiff] = useState(false);
  const [prevMd, setPrevMd] = useState('');

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');     // '' | 'questions' | 'reviewing' | 'rewriting'
  const [tab, setTab] = useState('edit');

  useEffect(() => {
    (async () => {
      try {
        const { spec } = await api.getSpec(id);
        setSpec(spec);
        setTitle(spec.title);
        setContent(spec.content);
        setContext(spec.context || '');
        setProjectType(spec.project_type || 'new');
        setObjective(spec.objective || '');
        setRepoUrl(spec.repo_url || '');
        setRepoAnalysis(spec.repo_analysis || null);
        setVersions(spec.versions || []);
        if (spec.latestReview) {
          setReview(spec.latestReview);
          setRewrittenMd(spec.latestReview.rewritten_markdown || '');
          restoreDecisions(spec.latestReview);
          setTab('review');
        }
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  function restoreDecisions(rv) {
    const d = rv.decisions;
    if (!d) return;
    const sel = {};
    (d.accepted || []).forEach((x) => { sel[x] = 'accepted'; });
    (d.rejected || []).forEach((x) => { sel[x] = 'rejected'; });
    setSelection(sel);
    setEdits(d.edits || {});
  }

  const suggestions = useMemo(
    () => (Array.isArray(review?.result?.suggestedRequirements) ? review.result.suggestedRequirements : []),
    [review]
  );
  const acceptedCount = suggestions.filter((s) => selection[s.id] === 'accepted').length;

  const existingReqs = useMemo(
    () => (Array.isArray(review?.result?.existingRequirements) ? review.result.existingRequirements : []),
    [review]
  );
  // Adopted rewrites of the author's own requirements (only those with a rewrite count).
  const improvementsAcceptedCount = existingReqs.filter(
    (e) => e.improvedText && selection[e.id] === 'accepted'
  ).length;

  const specFields = () => ({ title, content, context, projectType, objective, repoUrl });

  const save = async () => {
    setSaving(true); setError(''); setStatus('');
    try {
      await api.updateSpec(id, specFields());
      setStatus('Saved.');
      refreshSidebar();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  // Existing-project deep-read: persist the URL, then analyse the public repo.
  const analyseRepo = async () => {
    if (!repoUrl.trim()) { setError('Enter a public GitHub repository URL first.'); return; }
    setBusy('analysing'); setError(''); setStatus('');
    try {
      await api.updateSpec(id, specFields());
      const { analysis } = await api.ingestRepo(id);
      setRepoAnalysis(analysis);
      setStatus(`Analysed ${analysis.repo?.owner}/${analysis.repo?.repo} via ${analysis.provider}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  // Step 1 of review: fetch clarifying questions first (FR-4).
  const startReview = async () => {
    setBusy('questions'); setError(''); setStatus('');
    try {
      await api.updateSpec(id, specFields());
      const { questions } = await api.getQuestions(id);
      if (questions && questions.length) {
        setQuestions(questions);
        setTab('questions');
      } else {
        await runReview([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  // Step 2: run the review, incorporating any answers (or skipping them).
  const runReview = async (answerArr) => {
    setBusy('reviewing'); setError(''); setStatus('');
    try {
      const payloadAnswers = answerArr ?? questions.map((q) => ({
        id: q.id, question: q.question, answer: answers[q.id] || '',
      }));
      const { review } = await api.reviewSpec(id, { questions, answers: payloadAnswers });
      setReview(review);
      setSelection({});
      setEdits({});
      setRewrittenMd(review.rewritten_markdown || '');
      setTab('review');
      await refreshVersions();
      refreshSidebar();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const setDecision = (rid, st) =>
    setSelection((prev) => {
      const next = { ...prev };
      if (st === 'pending') delete next[rid]; else next[rid] = st;
      return next;
    });
  const setEdit = (rid, text) => setEdits((prev) => ({ ...prev, [rid]: text }));

  const updateSpecFromReview = async () => {
    setBusy('rewriting'); setError(''); setStatus('');
    try {
      // The selection map keys both new suggestions and the author's own
      // requirements (accept = adopt the AI rewrite). Send the full union so the
      // gate resolves each; ids are disjoint across the two streams.
      const selectedIds = Object.keys(selection).filter((rid) => selection[rid] === 'accepted');
      const rejectedIds = Object.keys(selection).filter((rid) => selection[rid] === 'rejected');
      const acceptedEdits = {};
      selectedIds.forEach((sid) => { if (edits[sid]) acceptedEdits[sid] = edits[sid]; });
      const { rewrite } = await api.rewriteSpec(id, { selectedIds, edits: acceptedEdits, rejectedIds });
      setRewrittenMd(rewrite.markdown);
      setShowDiff(false);
      await refreshVersions();
      refreshSidebar();
      setTab('spec');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const refreshVersions = async () => {
    try {
      const { versions } = await api.listVersions(id);
      setVersions(versions);
    } catch { /* non-fatal */ }
  };

  const toggleDiff = async () => {
    if (showDiff) { setShowDiff(false); return; }
    // Need the previous version's markdown to diff against the current one.
    const sorted = [...versions].sort((a, b) => b.version_no - a.version_no);
    const prev = sorted[1];
    if (!prev) { setStatus('No earlier version to compare against yet.'); return; }
    try {
      const { version } = await api.getVersion(id, prev.id);
      setPrevMd(version.markdown || '');
      setShowDiff(true);
    } catch (err) { setError(err.message); }
  };

  const viewVersion = async (vid) => {
    try {
      const { version } = await api.getVersion(id, vid);
      setRewrittenMd(version.markdown || '');
      setShowDiff(false);
      setTab('spec');
    } catch (err) { setError(err.message); }
  };

  const revert = async (vid) => {
    if (!confirm('Make this version the current one? Your later versions are kept in history.')) return;
    try {
      const { version, markdown } = await api.revertVersion(id, vid);
      setRewrittenMd(markdown);
      setShowDiff(false);
      await refreshVersions();
      refreshSidebar();
      setStatus(`Reverted — created version ${version.version_no}.`);
      setTab('spec');
    } catch (err) { setError(err.message); }
  };

  const uploadReplace = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(text);
    setStatus('File loaded into editor — save or review when ready.');
  };

  const exportSpec = async () => {
    try { await api.downloadSpec(id, title); } catch (err) { setError(err.message); }
  };
  const exportReview = async () => {
    try { await api.downloadExport(id, title); } catch (err) { setError(err.message); }
  };
  const copySpec = async () => {
    try { await navigator.clipboard.writeText(rewrittenMd); setStatus('Spec copied to clipboard.'); }
    catch { setError('Could not copy to clipboard.'); }
  };

  if (!spec && !error) return <div className="container"><p className="muted">Loading…</p></div>;

  const reviewing = busy === 'reviewing' || busy === 'questions';

  return (
    <div className="container">
      <div className="row" style={{ marginBottom: '1rem' }}>
        <Link to="/">← All specs</Link>
        <div className="spacer" />
        <button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        {tab === 'edit' && (
          <button className="primary" onClick={startReview} disabled={!!busy}>
            {reviewing ? 'Working…' : '✨ Run AI review'}
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {status && <p className="muted">{status}</p>}

      <div className="tabs">
        <button className={tab === 'edit' ? 'active' : ''} onClick={() => setTab('edit')}>Draft</button>
        <button className={tab === 'classify' ? 'active' : ''} onClick={() => setTab('classify')}>Catalogue</button>
        {questions.length > 0 && !review && (
          <button className={tab === 'questions' ? 'active' : ''} onClick={() => setTab('questions')}>Questions</button>
        )}
        <button className={tab === 'review' ? 'active' : ''} onClick={() => setTab('review')} disabled={!review}>
          Review {review?.result?.coverageScore != null ? `(${review.result.coverageScore})` : ''}
        </button>
        <button className={tab === 'spec' ? 'active' : ''} onClick={() => setTab('spec')} disabled={!rewrittenMd}>
          Updated spec
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); refreshVersions(); }} disabled={!versions.length}>
          History {versions.length ? `(${versions.length})` : ''}
        </button>
      </div>

      {/* ---------------- Draft ---------------- */}
      {tab === 'edit' && (
        <div className="card">
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Project setup: new project (objective) vs existing project (repo). */}
          <div className="field">
            <label>Project</label>
            <div className="seg" role="group" aria-label="Project type">
              <button
                type="button"
                className={projectType === 'new' ? 'active' : ''}
                aria-pressed={projectType === 'new'}
                onClick={() => setProjectType('new')}
              >
                New project
              </button>
              <button
                type="button"
                className={projectType === 'existing' ? 'active' : ''}
                aria-pressed={projectType === 'existing'}
                onClick={() => setProjectType('existing')}
              >
                Add to existing
              </button>
            </div>
          </div>

          {projectType === 'new' ? (
            <div className="field">
              <label>What do you want to achieve with this platform?</label>
              <textarea
                style={{ minHeight: 90 }}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="The outcome this platform/application should deliver for its users…"
              />
            </div>
          ) : (
            <div className="field">
              <label>GitHub repository <span className="muted">(public — we read the code &amp; what&apos;s already delivered)</span></label>
              <div className="row">
                <input
                  style={{ flex: 1, minWidth: '220px' }}
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                />
                <button type="button" onClick={analyseRepo} disabled={busy === 'analysing'}>
                  {busy === 'analysing' ? 'Analysing…' : '🔍 Analyse repository'}
                </button>
              </div>
              {repoAnalysis && (
                <div className="card" style={{ marginTop: '0.7rem', background: 'var(--panel-2)' }}>
                  <strong>Already in the codebase</strong>
                  <span className="muted" style={{ fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                    read-only context — the review won&apos;t re-suggest these
                  </span>
                  {repoAnalysis.stack?.length > 0 && (
                    <div className="req-matches" style={{ marginTop: '0.5rem' }}>
                      <span className="muted" style={{ fontSize: '0.78rem' }}>Stack:</span>
                      {repoAnalysis.stack.map((s) => <span key={s} className="badge">{s}</span>)}
                    </div>
                  )}
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem' }}>
                    {(repoAnalysis.deliveredRequirements || []).map((d, i) => (
                      <li key={i} className="muted" style={{ fontSize: '0.9rem' }}>
                        {typeof d === 'string' ? d : d.text}
                      </li>
                    ))}
                  </ul>
                  {repoAnalysis.truncated?.capped && (
                    <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 0 }}>
                      Read {repoAnalysis.truncated.filesRead} of {repoAnalysis.truncated.totalFiles} files (bounded deep read).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="field">
            <label>
              Draft requirements <span className="muted">(one per line — IDs and catalogue matches are filled in automatically)</span>{' '}
              <label style={{ display: 'inline', cursor: 'pointer', color: 'var(--accent)' }}>
                (or upload a file
                <input type="file" accept=".md,.txt,.markdown,text/plain" hidden onChange={uploadReplace} />
                )
              </label>
            </label>
            <RequirementsEditor value={content} onChange={setContent} />
          </div>

          <div className="field">
            <label>Project context &amp; constraints <span className="muted">(optional, but grounds the review)</span></label>
            <textarea
              style={{ minHeight: 120 }}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Domain, target users, existing stack, integrations, regulatory/compliance, scale, deadlines…"
            />
          </div>
          <p className="muted" style={{ marginBottom: 0 }}>
            Tip: even rough bullet points work — the reviewer will ask you a few clarifying questions,
            then extract, assess, and expand your draft using ISTQB, ISO 29148/25010, INCOSE, Volere, IREB &amp; BABOK.
          </p>
        </div>
      )}

      {/* ---------------- Catalogue / Mode B classification (FR-C3) ---------------- */}
      {tab === 'classify' && <ClassifyView specId={id} initialText={content} />}

      {/* ---------------- Clarifying questions (FR-4) ---------------- */}
      {tab === 'questions' && !review && (
        <div className="card">
          <strong>A few clarifying questions first</strong>
          <p className="muted" style={{ marginTop: '0.3rem' }}>
            Answering these makes the review far more accurate. You can skip any — or all — of them.
          </p>
          {questions.map((q) => (
            <div className="field" key={q.id}>
              <label>{q.question}{q.why && <span className="muted"> — {q.why}</span>}</label>
              <textarea
                style={{ minHeight: 70 }}
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                placeholder="Your answer (optional)"
              />
            </div>
          ))}
          <div className="row">
            <button onClick={() => runReview()} disabled={!!busy}>Skip &amp; review anyway</button>
            <div className="spacer" />
            <button className="primary" onClick={() => runReview()} disabled={!!busy}>
              {busy === 'reviewing' ? 'Reviewing…' : 'Submit answers &amp; review →'}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- Review + accept/reject gate ---------------- */}
      {tab === 'review' && review && (
        <>
          <div className="card action-bar">
            <div>
              <strong>
                {improvementsAcceptedCount} rewrite{improvementsAcceptedCount === 1 ? '' : 's'} adopted ·{' '}
                {acceptedCount} new requirement{acceptedCount === 1 ? '' : 's'} added
              </strong>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {acceptedCount === 0 && improvementsAcceptedCount === 0
                  ? 'Your original wording is kept. Accept a rewrite or a new requirement to fold it in — nothing changes your spec until you do.'
                  : 'Your spec keeps your original wording except where you accepted a rewrite, plus the new requirements you accepted.'}
              </div>
            </div>
            <div className="spacer" />
            <button onClick={exportReview}>⬇ Export review</button>
            <button className="primary" onClick={updateSpecFromReview} disabled={!!busy}>
              {busy === 'rewriting' ? 'Building…' : '📝 Build spec from accepted'}
            </button>
          </div>
          <ReviewView
            review={review}
            selection={selection}
            edits={edits}
            onSelect={setDecision}
            onEdit={setEdit}
          />
        </>
      )}

      {/* ---------------- Updated spec (rendered) ---------------- */}
      {tab === 'spec' && rewrittenMd && (
        <>
          <div className="action-bar" style={{ marginBottom: '0.8rem' }}>
            <div>
              <strong>Updated specification</strong>
              <span className="muted" style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                Goal · scope · constraints · outcomes (FR/NFR) · success criteria · Definition of Done
              </span>
            </div>
            <div className="spacer" />
            <button onClick={toggleDiff}>{showDiff ? 'Hide changes' : '± Highlight changes'}</button>
            <button onClick={copySpec}>⧉ Copy</button>
            <button
              onClick={updateSpecFromReview}
              disabled={!!busy}
              title="Rebuild from your accepted requirements and add an up-to-date, self-verifying Definition of Done"
            >
              {busy === 'rewriting' ? 'Regenerating…' : '↻ Regenerate'}
            </button>
            <button className="primary" onClick={exportSpec}>⬇ Export .md</button>
          </div>
          <div className="card">
            {showDiff
              ? <DiffView oldText={prevMd} newText={rewrittenMd} />
              : <Markdown source={rewrittenMd} />}
          </div>
        </>
      )}

      {/* ---------------- Version history (FR-17) ---------------- */}
      {tab === 'history' && (
        <div className="card">
          <strong>Version history</strong>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Every build creates a version. Changes vs the previous version are summarised below.
          </p>
          {versions.length === 0 && <p className="muted">No versions yet — build a spec from a review.</p>}
          {[...versions].sort((a, b) => b.version_no - a.version_no).map((v) => {
            const cs = v.change_summary || {};
            return (
              <div className="version-row" key={v.id}>
                <div>
                  <strong>v{v.version_no}</strong>
                  <span className="badge" style={{ marginLeft: '0.4rem' }}>{v.origin}</span>
                  <div className="muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(v.created_at).toLocaleString()}
                    {v.version_no > 1 && (
                      <> · <span className="diff-add">+{cs.added ?? 0}</span>{' '}
                        <span className="diff-del">−{cs.removed ?? 0}</span>{' '}
                        <span className="diff-mod">~{cs.modified ?? 0}</span></>
                    )}
                  </div>
                </div>
                <div className="row">
                  <button onClick={() => viewVersion(v.id)}>View</button>
                  <button onClick={() => revert(v.id)}>Make current</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Line-level change view between two spec versions (FR-2 / FR-17). */
function DiffView({ oldText, newText }) {
  const rows = diffLines(oldText, newText);
  return (
    <div className="diff">
      {rows.map((r, i) => (
        <div key={i} className={`diff-line diff-${r.type}`}>
          <span className="diff-gutter">{r.type === 'added' ? '+' : r.type === 'removed' ? '−' : ' '}</span>
          <span>{r.text || ' '}</span>
        </div>
      ))}
    </div>
  );
}
