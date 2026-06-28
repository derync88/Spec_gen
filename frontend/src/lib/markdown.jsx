/**
 * Tiny dependency-free Markdown renderer (NFR-6). Supports the subset the spec
 * output uses: #/##/### headings, bullet lists (with nesting), **bold**,
 * `code`, horizontal rules, and paragraphs. Not a general Markdown engine —
 * just enough to render our generated specs cleanly instead of as monospace.
 */

function renderInline(text, keyPrefix) {
  // Split on **bold** and `code`, keep delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={key}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) {
      const inner = p.slice(1, -1);
      const danger = inner.includes('VALUE NEEDED');
      return <code key={key} className={danger ? 'token-needed' : undefined}>{inner}</code>;
    }
    // Surface bare VALUE NEEDED tokens too (FR-10 AC-10.3).
    if (p.includes('VALUE NEEDED')) {
      const segs = p.split(/(VALUE NEEDED)/g);
      return segs.map((s, j) =>
        s === 'VALUE NEEDED'
          ? <span key={`${key}-${j}`} className="token-needed">VALUE NEEDED</span>
          : <span key={`${key}-${j}`}>{s}</span>
      );
    }
    return <span key={key}>{p}</span>;
  });
}

export function Markdown({ source }) {
  const lines = (source || '').split('\n');
  const blocks = [];
  let list = null;
  let key = 0;

  const flushList = () => {
    if (list) { blocks.push(<ul key={`ul-${key++}`}>{list}</ul>); list = null; }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { flushList(); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const Tag = `h${Math.min(level + 1, 6)}`;
      blocks.push(<Tag key={`h-${key++}`}>{renderInline(h[2], `h${key}`)}</Tag>);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushList(); blocks.push(<hr key={`hr-${key++}`} />); continue; }

    const li = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (li) {
      const nested = li[1].length >= 2;
      if (!list) list = [];
      list.push(
        <li key={`li-${key++}`} className={nested ? 'md-nested' : undefined}>
          {renderInline(li[2], `li${key}`)}
        </li>
      );
      continue;
    }

    flushList();
    blocks.push(<p key={`p-${key++}`}>{renderInline(line, `p${key}`)}</p>);
  }
  flushList();

  return <div className="md">{blocks}</div>;
}

export default Markdown;
