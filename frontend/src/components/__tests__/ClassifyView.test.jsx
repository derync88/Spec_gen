import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../api/client.js', () => ({
  api: {
    getSpecArchetypes: vi.fn(async () => ({ archetypes: [] })),
    classifySpec: vi.fn(async () => ({
      provider: 'mock',
      results: [{
        requirementId: 'R1',
        text: 'admins manage users',
        unmatched: false,
        matches: [{
          archetypeId: 'surface.crud-admin', name: 'CRUD admin', layer: 'surface',
          defaultPrescription: 'advisory', checkability: 'High', confidence: 0.9, status: 'confirmed', pulls: [],
        }],
      }],
      bespoke: [],
    })),
    decideArchetype: vi.fn(async () => ({})),
  },
}));

import ClassifyView from '../ClassifyView.jsx';
import { api } from '../../api/client.js';

describe('ClassifyView (Mode B)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('classifies free-text and renders matches with confirm/reject controls', async () => {
    const user = userEvent.setup();
    render(<ClassifyView specId="s1" initialText="admins manage users" />);

    await user.click(screen.getByRole('button', { name: /Classify against catalogue/ }));

    expect(await screen.findByText('CRUD admin')).toBeInTheDocument();
    expect(screen.getByText('90% match')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(api.classifySpec).toHaveBeenCalledWith('s1', { requirements: ['admins manage users'] });
  });

  it('FR-C5: rejecting a match calls the decide endpoint (no silent application)', async () => {
    const user = userEvent.setup();
    render(<ClassifyView specId="s1" initialText="admins manage users" />);
    await user.click(screen.getByRole('button', { name: /Classify against catalogue/ }));
    await screen.findByText('CRUD admin');

    await user.click(screen.getByRole('button', { name: 'Reject' }));
    expect(api.decideArchetype).toHaveBeenCalledWith('s1', 'surface.crud-admin', 'rejected');
  });
});
