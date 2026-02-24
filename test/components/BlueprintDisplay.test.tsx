import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlueprintDisplay from '../../components/BlueprintDisplay';
import type { ReconstructionBlueprint } from '../../types';

const fixtureBlueprint: ReconstructionBlueprint = {
  telemetry: {
    bpm: '128',
    key: 'A minor',
    groove: '16th note swing',
  },
  arrangement: [{ timeRange: '0:00-0:32', label: 'Intro', description: 'Filtered pad and kick' }],
  instrumentation: [
    {
      element: 'Sub Bass',
      timbre: 'Sine with soft saturation',
      frequency: '40–80 Hz',
      abletonDevice: 'Operator, one oscillator, low pass',
    },
  ],
  fxChain: [{ artifact: 'Tail reverb', recommendation: 'Reverb on return' }],
  secretSauce: {
    trick: 'Sidechain ducking',
    execution: 'Compressor on pad, sidechain from kick',
  },
};

describe('BlueprintDisplay', () => {
  it('renders with fixture blueprint without crashing', () => {
    render(<BlueprintDisplay blueprint={fixtureBlueprint} />);

    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('A minor')).toBeInTheDocument();
    expect(screen.getByText(/16th note swing/i)).toBeInTheDocument();
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Sub Bass')).toBeInTheDocument();
    expect(screen.getByText(/Sidechain ducking/i)).toBeInTheDocument();
  });
});
