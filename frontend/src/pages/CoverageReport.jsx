import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import CoverageReportSections from '../components/CoverageReportSections.jsx';

/** Rebuild the accept/reject selection map from the review's saved decisions, so
 *  "How to reach 100" reflects the author's progress in this read-only window. */
function selectionFromDecisions(review) {
  const sel = {};
  const d = review?.decisions;
  if (!d) return sel;
  (d.accepted || []).forEach((id) => { sel[id] = 'accepted'; });
  (d.rejected || []).forEach((id) => { sel[id] = 'rejected'; });
  return sel;
}

/**
 * Standalone full coverage report, opened in its own window/tab from the review
 * tab. Authenticates from the persisted session, fetches the spec, and renders
 * the coverage sections that were removed from the review view.
 */
export default function CoverageReport() {
  const { id } = useParams();
  const { user, ready } = useAuth();
  const [spec, setSpec] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      try {
        const { spec: s } = await api.getSpec(id);
        setSpec(s);
        document.title = `Coverage report — ${s.title || 'spec'}`;
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id, ready, user]);

  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;

  const review = spec?.latestReview;

  return (
    <div className="container report">
      <div className="row" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Full coverage report</h2>
          {spec && <div className="muted">{spec.title}</div>}
        </div>
        <div className="spacer" />
        <button onClick={() => window.print()}>🖨 Print</button>
      </div>

      {error && <p className="error">{error}</p>}
      {!spec && !error && <p className="muted">Loading…</p>}
      {spec && !review && (
        <p className="muted">No review yet — run an AI review on this spec to generate a coverage report.</p>
      )}
      {review && <CoverageReportSections review={review} selection={selectionFromDecisions(review)} />}
    </div>
  );
}
