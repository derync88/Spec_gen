import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CoverageReportSections from '../CoverageReportSections.jsx';

const review = {
  provider: 'mock',
  model: 'mock-reviewer',
  result: {
    coverageScore: 52,
    summary: 'A review.',
    coverageByCategory: [
      { category: 'Functional Suitability', standard: 'ISO 25010', status: 'partial', score: 60, notes: 'Alternate flows under-specified.' },
      { category: 'Security', standard: 'ISO 25010', status: 'missing', score: 20, notes: 'No authn/authz found.' },
    ],
    existingRequirements: [
      {
        id: 'FR-1',
        type: 'functional',
        smart: { specific: false, measurable: false, achievable: true, relevant: true, testable: false },
        improvedText: 'Rewritten requirement.',
      },
    ],
    suggestedRequirements: [
      { id: 'NFR-9', type: 'non-functional', category: 'Security', text: 'Require authentication' },
    ],
    gaps: [{ area: 'Error & alternate flows', description: 'Only happy path.', severity: 'high' }],
    ambiguities: [{ text: 'fast', problem: 'subjective', suggestion: 'use a number' }],
    traceability: { orphans: [{ item: 'FR-1', issue: 'No parent goal.' }], notes: 'Trace it.' },
  },
};

// MemoryRouter because CoverageReportSections imports scoreColor from Dashboard,
// which pulls in router-aware code in the module graph.
const renderWith = (props) => render(<MemoryRouter><CoverageReportSections {...props} /></MemoryRouter>);

describe('CoverageReportSections', () => {
  it('renders all six coverage sections', () => {
    renderWith({ review, selection: {} });
    expect(screen.getByText('Coverage score')).toBeInTheDocument();
    expect(screen.getByText('How to reach 100')).toBeInTheDocument();
    expect(screen.getByText('Coverage by category')).toBeInTheDocument();
    expect(screen.getByText('Coverage gaps')).toBeInTheDocument();
    expect(screen.getByText('Ambiguities to resolve')).toBeInTheDocument();
    expect(screen.getByText(/Traceability/)).toBeInTheDocument();
  });

  it('ranks uncovered categories biggest-shortfall-first and ties them to suggestions', () => {
    renderWith({ review, selection: {} });
    const gains = screen.getAllByText(/^\+\d+$/).map((n) => n.textContent);
    expect(gains[0]).toBe('+80'); // Security (20/100) before Functional Suitability (60/100, +40)
    expect(gains).toContain('+40');
    expect(screen.getByText(/0\/1 matching suggestions? accepted \(NFR-9\)/)).toBeInTheDocument();
  });

  it('reflects saved progress from the decisions-derived selection', () => {
    renderWith({ review, selection: { 'NFR-9': 'accepted' } });
    expect(screen.getByText(/✓ 1\/1 matching suggestions? accepted \(NFR-9\)/)).toBeInTheDocument();
  });
});
