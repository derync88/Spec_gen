/**
 * Render a reviewed spec (original draft + AI analysis) into a single,
 * Claude-Code-ready Markdown document.
 */

function smartFlags(smart) {
  if (!smart) return '';
  const keys = ['specific', 'measurable', 'achievable', 'relevant', 'testable'];
  return keys
    .map((k) => `${k[0].toUpperCase()}:${smart[k] ? '✓' : '✗'}`)
    .join(' ');
}

export function renderMarkdown({ title, content, review }) {
  const r = review?.result || {};
  const lines = [];

  lines.push(`# ${title || 'Specification'}`);
  lines.push('');
  if (review) {
    lines.push(
      `> Reviewed by **${review.provider}**${review.model ? ` (${review.model})` : ''} — coverage score **${r.coverageScore ?? 'n/a'}/100**`
    );
    lines.push('');
  }

  if (r.summary) {
    lines.push('## Review summary');
    lines.push('');
    lines.push(r.summary);
    lines.push('');
  }

  // Coverage by category
  if (Array.isArray(r.coverageByCategory) && r.coverageByCategory.length) {
    lines.push('## Coverage by category');
    lines.push('');
    lines.push('| Category | Standard | Status | Score | Notes |');
    lines.push('|---|---|---|---|---|');
    for (const c of r.coverageByCategory) {
      lines.push(
        `| ${c.category || ''} | ${c.standard || ''} | ${c.status || ''} | ${c.score ?? ''} | ${(c.notes || '').replace(/\|/g, '\\|')} |`
      );
    }
    lines.push('');
  }

  // Functional then non-functional suggested requirements
  const suggested = Array.isArray(r.suggestedRequirements) ? r.suggestedRequirements : [];
  const fr = suggested.filter((s) => s.type !== 'non-functional');
  const nfr = suggested.filter((s) => s.type === 'non-functional');

  const renderReqs = (heading, reqs) => {
    if (!reqs.length) return;
    lines.push(`## ${heading}`);
    lines.push('');
    for (const req of reqs) {
      lines.push(`### ${req.id || ''} ${req.text || ''}`.trim());
      if (req.category) lines.push(`- **Category:** ${req.category}`);
      if (req.priority) lines.push(`- **Priority:** ${req.priority}`);
      if (req.istqbTechnique) lines.push(`- **ISTQB technique:** ${req.istqbTechnique}`);
      if (req.standardRef) lines.push(`- **Standard:** ${req.standardRef}`);
      if (req.rationale) lines.push(`- **Rationale:** ${req.rationale}`);
      if (Array.isArray(req.acceptanceCriteria) && req.acceptanceCriteria.length) {
        lines.push('- **Acceptance criteria:**');
        for (const ac of req.acceptanceCriteria) lines.push(`  - ${ac}`);
      }
      lines.push('');
    }
  };

  renderReqs('Suggested functional requirements', fr);
  renderReqs('Suggested non-functional requirements', nfr);

  // Existing requirements assessment
  if (Array.isArray(r.existingRequirements) && r.existingRequirements.length) {
    lines.push('## Assessment of existing requirements');
    lines.push('');
    for (const req of r.existingRequirements) {
      lines.push(`### ${req.id || ''} (${req.type || 'requirement'})`);
      if (req.text) lines.push(`> ${req.text}`);
      const flags = smartFlags(req.smart);
      if (flags) lines.push(`- **SMART:** ${flags}`);
      if (Array.isArray(req.issues) && req.issues.length) {
        lines.push('- **Issues:**');
        for (const i of req.issues) lines.push(`  - ${i}`);
      }
      if (req.improvedText) lines.push(`- **Improved:** ${req.improvedText}`);
      lines.push('');
    }
  }

  // Gaps
  if (Array.isArray(r.gaps) && r.gaps.length) {
    lines.push('## Coverage gaps');
    lines.push('');
    for (const g of r.gaps) {
      lines.push(`- **[${g.severity || 'med'}] ${g.area || ''}** — ${g.description || ''}`);
    }
    lines.push('');
  }

  // Ambiguities
  if (Array.isArray(r.ambiguities) && r.ambiguities.length) {
    lines.push('## Ambiguities to resolve');
    lines.push('');
    for (const a of r.ambiguities) {
      lines.push(`- _"${a.text || ''}"_ — ${a.problem || ''} → ${a.suggestion || ''}`);
    }
    lines.push('');
  }

  // Traceability
  if (r.traceability) {
    lines.push('## Traceability & orphan detection');
    lines.push('');
    if (Array.isArray(r.traceability.orphans) && r.traceability.orphans.length) {
      for (const o of r.traceability.orphans) {
        lines.push(`- **${o.item || ''}** — ${o.issue || ''}`);
      }
    }
    if (r.traceability.notes) {
      lines.push('');
      lines.push(r.traceability.notes);
    }
    lines.push('');
  }

  // Original draft for reference
  lines.push('---');
  lines.push('');
  lines.push('## Original draft (for reference)');
  lines.push('');
  lines.push(content || '_(empty)_');
  lines.push('');

  return lines.join('\n');
}
