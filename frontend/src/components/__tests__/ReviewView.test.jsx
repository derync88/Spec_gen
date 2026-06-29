import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReviewView from '../ReviewView.jsx';

const review = {
  provider: 'mock',
  model: 'mock-reviewer',
  result: {
    coverageScore: 50,
    summary: 'A review.',
    suggestedRequirements: [
      { id: 'FR-1', source: 'model-suggested', type: 'functional', text: 'Do the thing', priority: 'must' },
    ],
  },
};

const noop = () => {};

describe('ReviewView gate', () => {
  it('AC-1.1: each suggestion shows Accept/Reject/Edit and defaults to non-accepted', () => {
    render(<ReviewView review={review} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);

    const accept = screen.getByRole('button', { name: 'Accept' });
    expect(accept).toBeInTheDocument();
    expect(accept).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Do the thing')).toBeInTheDocument();
  });

  it('FR-3: renders the provenance label from the suggestion source', () => {
    render(<ReviewView review={review} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);
    expect(screen.getByText('AI-suggested')).toBeInTheDocument();
  });

  it('reflects an accepted decision in the control state', () => {
    render(
      <ReviewView review={review} selection={{ 'FR-1': 'accepted' }} edits={{}} onSelect={noop} onEdit={noop} />
    );
    const accepted = screen.getByRole('button', { name: '✓ Accepted' });
    expect(accepted).toHaveAttribute('aria-pressed', 'true');
  });

  it('invokes onSelect when Accept is clicked', async () => {
    const onSelect = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ReviewView review={review} selection={{}} edits={{}} onSelect={onSelect} onEdit={noop} />);
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onSelect).toHaveBeenCalledWith('FR-1', 'accepted');
  });
});

const catalogueReview = {
  provider: 'mock',
  result: {
    coverageScore: 60,
    constraintRatio: { warning: 'Constraints are 50% of composed requirements (>20%) — re-check.' },
    catalogueProbes: [{ text: 'No cross-tenant leakage', prescription: 'constraint', archetypeName: 'Tenancy' }],
    suggestedRequirements: [
      { id: 'FR-2', source: 'model-suggested', sourceArchetypeId: 'foundation.authorisation', prescription: 'constraint', type: 'functional', text: 'Deny by default' },
      { id: 'FR-3', source: 'model-suggested', sourceArchetypeId: 'foundation.authorisation', prescription: 'advisory', type: 'functional', text: 'Permission model governs access' },
    ],
  },
};

describe('ReviewView catalogue composition (Phase 3)', () => {
  it('FR-C6: groups by archetype and bulk-accepts all of its requirements', async () => {
    const onSelect = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ReviewView review={catalogueReview} selection={{}} edits={{}} onSelect={onSelect} onEdit={noop} />);

    expect(screen.getByText('From catalogue archetypes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Accept all' }));
    expect(onSelect).toHaveBeenCalledWith('FR-2', 'accepted');
    expect(onSelect).toHaveBeenCalledWith('FR-3', 'accepted');
  });

  it('surfaces the constraint-ratio warning and gap probes', () => {
    render(<ReviewView review={catalogueReview} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);
    expect(screen.getByText(/Constraints are 50%/)).toBeInTheDocument();
    expect(screen.getByText(/No cross-tenant leakage/)).toBeInTheDocument();
  });

  it('renders prescription badges', () => {
    render(<ReviewView review={catalogueReview} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);
    expect(screen.getAllByText('constraint').length).toBeGreaterThan(0);
  });
});

const combinedReview = {
  provider: 'mock',
  result: {
    coverageScore: 52,
    coverageByCategory: [
      { category: 'Functional Suitability', standard: 'ISO 25010', status: 'partial', score: 60, notes: 'Alternate flows under-specified.' },
      { category: 'Security', standard: 'ISO 25010', status: 'missing', score: 20, notes: 'No authn/authz found.' },
    ],
    existingRequirements: [
      {
        id: 'FR-1',
        type: 'functional',
        text: 'The system should let users do the main task.',
        smart: { specific: false, measurable: false, achievable: true, relevant: true, testable: false },
        improvedSmart: { specific: true, measurable: true, achievable: true, relevant: true, testable: true },
        issues: ['Vague ("main task", "should")', 'Not measurable'],
        improvedText: 'The system shall allow an authenticated user to create, view, edit, and delete a record within 2 seconds.',
      },
    ],
    suggestedRequirements: [
      { id: 'FR-5', source: 'model-suggested', type: 'functional', text: 'Validate boundary inputs', priority: 'must' },
      { id: 'NFR-9', source: 'model-suggested', type: 'non-functional', category: 'Security', text: 'Require authentication on all endpoints', priority: 'must' },
    ],
  },
};

describe('ReviewView combined requirement card', () => {
  it('shows what was written, the SMART rating, the feedback, and the rewrite on one card', () => {
    render(<ReviewView review={combinedReview} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);
    expect(screen.getByText('Your requirements — reviewed')).toBeInTheDocument();
    // What was written
    expect(screen.getByText(/let users do the main task/)).toBeInTheDocument();
    // Feedback against SMART
    expect(screen.getByText(/Not measurable/)).toBeInTheDocument();
    // The suggested rewrite
    expect(screen.getByText(/create, view, edit, and delete a record/)).toBeInTheDocument();
  });

  it('rates SMART for BOTH the original and the rewrite, captioned per column', () => {
    render(<ReviewView review={combinedReview} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);
    // Two SMART rows, each captioned and aria-labelled to its version.
    expect(screen.getByLabelText('SMART rating of what you wrote')).toBeInTheDocument();
    expect(screen.getByLabelText('SMART rating of the suggested rewrite')).toBeInTheDocument();
    // The original fails Specific (S✗); the rewrite passes it (S✓).
    expect(screen.getByText('S✗')).toBeInTheDocument();
    expect(screen.getByText('S✓')).toBeInTheDocument();
  });

  it('gives the author an accept-rewrite / keep-mine / edit gate', () => {
    render(<ReviewView review={combinedReview} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);
    expect(screen.getByRole('button', { name: 'Accept rewrite' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep mine' })).toBeInTheDocument();
  });

  it('Accept rewrite emits an accepted decision for the requirement id', async () => {
    const onSelect = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ReviewView review={combinedReview} selection={{}} edits={{}} onSelect={onSelect} onEdit={noop} />);
    await user.click(screen.getByRole('button', { name: 'Accept rewrite' }));
    expect(onSelect).toHaveBeenCalledWith('FR-1', 'accepted');
  });

  it('keeps new gap suggestions in their own labelled section', () => {
    render(<ReviewView review={combinedReview} selection={{}} edits={{}} onSelect={noop} onEdit={noop} />);
    expect(screen.getByText(/Suggested additional functional requirements/)).toBeInTheDocument();
    expect(screen.getByText('Validate boundary inputs')).toBeInTheDocument();
  });
});

describe('ReviewView no longer shows the coverage report sections', () => {
  it('omits coverage score, how-to-reach-100, category table, gaps, ambiguities and traceability', () => {
    render(
      <ReviewView
        review={{ result: { ...combinedReview.result, gaps: [{ area: 'Errors', description: 'x', severity: 'high' }], ambiguities: [{ text: 'fast', problem: 'vague', suggestion: 'measure' }], traceability: { orphans: [{ item: 'FR-1', issue: 'no goal' }] } } }}
        selection={{}}
        edits={{}}
        onSelect={noop}
        onEdit={noop}
      />
    );
    expect(screen.queryByText('How to reach 100')).not.toBeInTheDocument();
    expect(screen.queryByText('Coverage by category')).not.toBeInTheDocument();
    expect(screen.queryByText('Coverage score')).not.toBeInTheDocument();
    expect(screen.queryByText('Coverage gaps')).not.toBeInTheDocument();
    expect(screen.queryByText('Ambiguities to resolve')).not.toBeInTheDocument();
    expect(screen.queryByText(/Traceability/)).not.toBeInTheDocument();
    // The per-requirement review still shows.
    expect(screen.getByText('Your requirements — reviewed')).toBeInTheDocument();
  });
});
