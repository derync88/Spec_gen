import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSpecs } from '../context/SpecsContext.jsx';
import { api } from '../api/client.js';
import { scoreColor } from '../pages/Dashboard.jsx';

/**
 * Persistent left rail listing all of the user's specs — the "go back to an old
 * conversation" pattern from ChatGPT/Claude, adapted for saved specs.
 */
export default function Sidebar() {
  const { specs, loaded, refresh } = useSpecs();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('specgen_sidebar_collapsed') === '1'
  );

  const setCollapse = (v) => {
    setCollapsed(v);
    localStorage.setItem('specgen_sidebar_collapsed', v ? '1' : '0');
  };

  if (collapsed) {
    return (
      <button className="sidebar-reopen" title="Show specs" onClick={() => setCollapse(false)}>
        ☰
      </button>
    );
  }

  const activeMatch = location.pathname.match(/\/specs\/([^/]+)/);
  const activeId = activeMatch ? activeMatch[1] : null;

  const q = query.trim().toLowerCase();
  const filtered = q ? specs.filter((s) => (s.title || '').toLowerCase().includes(q)) : specs;

  const remove = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this spec? This cannot be undone.')) return;
    try {
      await api.deleteSpec(id);
      await refresh();
      if (activeId === id) navigate('/');
    } catch { /* ignore */ }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <button className="primary new-spec" onClick={() => navigate('/')}>
          + New spec
        </button>
        <button className="ghost collapse-btn" title="Hide sidebar" onClick={() => setCollapse(true)}>
          «
        </button>
      </div>

      <input
        className="sidebar-search"
        placeholder="Search specs…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="sidebar-list">
        {!loaded && <p className="muted sidebar-empty">Loading…</p>}
        {loaded && specs.length === 0 && (
          <p className="muted sidebar-empty">No specs yet. Create your first one.</p>
        )}
        {loaded && specs.length > 0 && filtered.length === 0 && (
          <p className="muted sidebar-empty">No specs match “{query}”.</p>
        )}
        {filtered.map((s) => (
          <div
            key={s.id}
            className={`sidebar-item ${activeId === s.id ? 'active' : ''}`}
            onClick={() => navigate(`/specs/${s.id}`)}
            title={s.title}
          >
            <div className="sidebar-item-main">
              <span className="sidebar-item-title">{s.title || 'Untitled spec'}</span>
              <span className="sidebar-item-date">
                {new Date(s.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="sidebar-item-meta">
              {s.latest_score != null && (
                <span className="score-dot" style={{ color: scoreColor(s.latest_score) }}>
                  {s.latest_score}
                </span>
              )}
              <button className="sidebar-del" title="Delete spec" onClick={(e) => remove(s.id, e)}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
