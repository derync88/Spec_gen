import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../api/client.js', () => ({
  api: {
    matchCatalogue: vi.fn(async () => ({
      perRequirement: [{
        requirementId: 'r0',
        candidates: [{ archetypeId: 'foundation.identity', name: 'Identity', layer: 'foundation', confidence: 0.75 }],
      }],
    })),
  },
}));

import RequirementsEditor from '../RequirementsEditor.jsx';
import { api } from '../../api/client.js';

describe('RequirementsEditor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always shows exactly one trailing empty box', () => {
    render(<RequirementsEditor value="" onChange={() => {}} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByText('FR-1')).toBeInTheDocument();
  });

  it('splits an existing newline blob into rows plus a trailing empty', () => {
    render(<RequirementsEditor value={'first req\nsecond req'} onChange={() => {}} />);
    // two filled rows + one trailing empty = 3 inputs, IDs FR-1..FR-3
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
    expect(screen.getByText('FR-3')).toBeInTheDocument();
  });

  it('typing into the trailing box adds a new trailing box and renumbers IDs', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RequirementsEditor value="" onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'users sign in');

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByText('FR-2')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith('users sign in');
  });

  it('runs a live catalogue lookup and renders matched archetype badges', async () => {
    const user = userEvent.setup();
    render(<RequirementsEditor value="" onChange={() => {}} />);

    await user.type(screen.getByRole('textbox'), 'users sign in');

    expect(await screen.findByText('Identity')).toBeInTheDocument();
    expect(api.matchCatalogue).toHaveBeenCalled();
  });
});
