import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import BlueprintDisplay from '../../components/BlueprintDisplay';
import { ReconstructionBlueprint } from '../../types';

describe('BlueprintDisplay', () => {
  it('renders all sections given a fixture blueprint', () => {
    const fixture: ReconstructionBlueprint = {
      telemetry: {
        bpm: '120',
        key: 'C Major',
        groove: 'Straight 4/4',
      },
      arrangement: [{ timeRange: '0:00-1:00', label: 'Intro', description: 'Starts quiet' }],
      instrumentation: [
        { element: 'Kick', timbre: 'Punchy', frequency: 'Low', abletonDevice: 'Drum Buss' },
      ],
      fxChain: [{ artifact: 'Reverb Tail', recommendation: 'Valhalla Room' }],
      secretSauce: {
        trick: 'Parallel compression',
        execution: 'Mix parallel bus at -10dB',
      },
    };

    render(<BlueprintDisplay blueprint={fixture} />);

    expect(screen.getByText(/Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/Arrangement/i)).toBeInTheDocument();
    expect(screen.getByText(/Instrumentation/i)).toBeInTheDocument();
    expect(screen.getByText(/Effects Chain/i)).toBeInTheDocument();
    expect(screen.getByText(/The Secret Sauce/i)).toBeInTheDocument();
  });

  it('handles missing optional fields without crashing', () => {
    const fixture: ReconstructionBlueprint = {
      telemetry: { bpm: '120', key: 'C Major', groove: 'Straight 4/4' },
      arrangement: [],
      instrumentation: [],
      fxChain: [],
      secretSauce: { trick: '', execution: '' },
    };

    render(<BlueprintDisplay blueprint={fixture} />);
    const els = screen.getAllByText(/Telemetry/i);
    expect(els.length).toBeGreaterThan(0);
  });
});
