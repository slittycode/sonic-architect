import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import BlueprintDisplay from '../components/BlueprintDisplay';
import type { ReconstructionBlueprint } from '../types';

const FIXTURE: ReconstructionBlueprint = {
  telemetry: { bpm: '140', key: 'D major', groove: 'Driving techno' },
  arrangement: [
    { timeRange: '0:00–0:30', label: 'Intro', description: 'Build-up with filter sweep.' },
    { timeRange: '0:30–3:00', label: 'Drop', description: 'Full energy section.' },
  ],
  instrumentation: [
    { element: 'Kick', timbre: 'Boomy', frequency: '40–80 Hz', abletonDevice: 'Drum Rack' },
    { element: 'Lead', timbre: 'Bright saw', frequency: '1–4 kHz', abletonDevice: 'Wavetable' },
  ],
  fxChain: [
    { artifact: 'Harsh highs', recommendation: 'EQ Eight: dip at 3kHz by -3dB' },
  ],
  secretSauce: { trick: 'Polyrhythm overlay', execution: 'Layer 3/4 pattern over 4/4 kick.' },
  meta: { provider: 'local', analysisTime: 200, sampleRate: 48000, duration: 240, channels: 2 },
};

describe('BlueprintDisplay', () => {
  it('renders telemetry data', () => {
    render(<BlueprintDisplay blueprint={FIXTURE} />);
    expect(screen.getByText('140')).toBeInTheDocument();
    expect(screen.getByText('D major')).toBeInTheDocument();
    expect(screen.getByText('Driving techno')).toBeInTheDocument();
  });

  it('renders all arrangement sections', () => {
    render(<BlueprintDisplay blueprint={FIXTURE} />);
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(screen.getByText('Drop')).toBeInTheDocument();
  });

  it('renders instrumentation elements', () => {
    render(<BlueprintDisplay blueprint={FIXTURE} />);
    expect(screen.getByText('Kick')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('renders FX chain', () => {
    render(<BlueprintDisplay blueprint={FIXTURE} />);
    expect(screen.getByText('Harsh highs')).toBeInTheDocument();
  });

  it('renders secret sauce', () => {
    render(<BlueprintDisplay blueprint={FIXTURE} />);
    expect(screen.getByText('Polyrhythm overlay')).toBeInTheDocument();
  });

  it('handles missing optional meta', () => {
    const { meta: _, ...noMeta } = FIXTURE;
    // Should not throw
    expect(() => render(<BlueprintDisplay blueprint={noMeta as ReconstructionBlueprint} />)).not.toThrow();
  });

  it('handles empty arrays', () => {
    const minimal: ReconstructionBlueprint = {
      ...FIXTURE,
      arrangement: [],
      instrumentation: [],
      fxChain: [],
    };
    expect(() => render(<BlueprintDisplay blueprint={minimal} />)).not.toThrow();
  });
});
