import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

/**
 * Structured draft-requirements editor (one field per requirement).
 *
 * - A pre-populated positional ID (FR-1, FR-2, …) sits to the left of each row.
 * - There is always exactly one trailing empty box: typing into it promotes it
 *   to a real row and a fresh empty box appears underneath. No "Add" button —
 *   rows are managed automatically.
 * - As each requirement is typed, a debounced, zero-LLM catalogue lookup runs
 *   and shows the matched archetype(s) inline (these are hints only; nothing
 *   enters the spec until accepted in the review step).
 *
 * Storage stays as the newline `content` blob the rest of the pipeline reads:
 * `value` is split into rows; rows are joined back via `onChange`.
 */

let ROW_SEQ = 0;
const newRow = (text = '') => ({ id: `r${ROW_SEQ++}`, text });

function splitRows(value) {
  const rows = String(value || '')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => newRow(l));
  rows.push(newRow('')); // always a trailing empty box
  return rows;
}

/** Keep non-empty rows (plus the row being edited), and guarantee one trailing empty. */
function reconcile(rows, editedId) {
  const kept = rows.filter((r) => r.text.trim() !== '' || r.id === editedId);
  const last = kept[kept.length - 1];
  if (!last || last.text.trim() !== '') kept.push(newRow(''));
  return kept;
}

const joinRows = (rows) => rows.filter((r) => r.text.trim() !== '').map((r) => r.text.trim()).join('\n');

function RequirementRow({ idLabel, row, onChange, onDelete, canDelete }) {
  const [matches, setMatches] = useState([]);
  const text = row.text;

  useEffect(() => {
    const t = text.trim();
    if (!t) { setMatches([]); return undefined; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await api.matchCatalogue({ requirements: [{ id: row.id, text: t }] });
        if (!cancelled) setMatches(res.perRequirement?.[0]?.candidates || []);
      } catch {
        if (!cancelled) setMatches([]);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text, row.id]);

  return (
    <div className="req-row">
      <span className="req-gutter" aria-hidden="true">{idLabel}</span>
      <div className="req-main">
        <div className="req-input-line">
          <input
            value={text}
            onChange={(e) => onChange(row.id, e.target.value)}
            placeholder="Describe one requirement…"
            aria-label={`Requirement ${idLabel}`}
          />
          {canDelete && (
            <button
              type="button"
              className="req-delete"
              onClick={() => onDelete(row.id)}
              aria-label={`Delete requirement ${idLabel}`}
              title={`Delete ${idLabel}`}
            >
              ×
            </button>
          )}
        </div>
        {matches.length > 0 && (
          <div className="req-matches">
            <span className="muted" style={{ fontSize: '0.75rem' }}>Catalogue:</span>
            {matches.map((m) => (
              <span key={m.archetypeId} className="badge source" title={`${m.layer || ''} · ${Math.round(m.confidence * 100)}% match`}>
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RequirementsEditor({ value, onChange }) {
  const [rows, setRows] = useState(() => splitRows(value));
  const lastEmitted = useRef(value || '');

  // Re-derive rows when the value changes from OUTSIDE (initial load, file
  // upload) — but ignore our own echoes so typing never resets row identity.
  useEffect(() => {
    if ((value || '') !== lastEmitted.current) {
      lastEmitted.current = value || '';
      setRows(splitRows(value));
    }
  }, [value]);

  const handleRowChange = (id, text) => {
    setRows((prev) => {
      const next = reconcile(prev.map((r) => (r.id === id ? { ...r, text } : r)), id);
      const content = joinRows(next);
      lastEmitted.current = content;
      onChange(content);
      return next;
    });
  };

  // Remove a row entirely. Because IDs (FR-1, FR-2, …) are positional, the
  // remaining rows re-number automatically on the next render.
  const handleRowDelete = (id) => {
    setRows((prev) => {
      const next = reconcile(prev.filter((r) => r.id !== id), null);
      const content = joinRows(next);
      lastEmitted.current = content;
      onChange(content);
      return next;
    });
  };

  return (
    <div className="req-editor">
      {rows.map((row, i) => {
        const isTrailingEmpty = i === rows.length - 1 && row.text.trim() === '';
        return (
          <RequirementRow
            key={row.id}
            idLabel={`FR-${i + 1}`}
            row={row}
            onChange={handleRowChange}
            onDelete={handleRowDelete}
            canDelete={!isTrailingEmpty}
          />
        );
      })}
    </div>
  );
}
