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
