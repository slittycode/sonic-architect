import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlueprintDisplay from '../../components/BlueprintDisplay';
import { ReconstructionBlueprint } from '../../types';

const createMockBlueprint = (includeChords: boolean): ReconstructionBlueprint => ({
  telemetry: {
    bpm: '120',
    key: 'C Major',
    groove: 'Steady',
    bpmConfidence: 0.9,
    keyConfidence: 0.85,
  },
  arrangement: [
    {
      timeRange: '0:00–0:30',
      label: 'Intro',
      description: 'Opening section',
    },
  ],
  ...(includeChords && {
    chordProgression: [
      {
        timeRange: '0:00–0:04',
        chord: 'Cmaj',
        root: 'C',
        quality: 'Major',
        confidence: 0.92,
      },
      {
        timeRange: '0:04–0:08',
        chord: 'Am',
        root: 'A',
        quality: 'Minor',
        confidence: 0.88,
      },
      {
        timeRange: '0:08–0:12',
        chord: 'Fmaj',
        root: 'F',
        quality: 'Major',
        confidence: 0.85,
      },
      {
        timeRange: '0:12–0:16',
        chord: 'G7',
        root: 'G',
        quality: 'Dominant 7th',
        confidence: 0.90,
      },
    ],
    chordProgressionSummary: 'I - vi - IV - V7',
  }),
  instrumentation: [
    {
      element: 'Bass',
      timbre: 'Warm',
      frequency: '40-120Hz',
      abletonDevice: 'Operator',
    },
  ],
  fxChain: [
    {
      artifact: 'Compression',
      recommendation: 'Use Glue Compressor',
    },
  ],
  secretSauce: {
    trick: 'Saturation',
    execution: 'Apply subtle drive',
  },
  meta: {
    provider: 'local',
    analysisTime: 150,
    sampleRate: 48000,
    duration: 16,
    channels: 2,
  },
});

describe('BlueprintDisplay - Chord Progression', () => {
  it('renders Chord Progression panel when chordProgression data exists', () => {
    const blueprint = createMockBlueprint(true);
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    expect(screen.getByText('Chord Progression')).toBeInTheDocument();
  });

  it('does NOT render Chord Progression panel when chordProgression is undefined', () => {
    const blueprint = createMockBlueprint(false);
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    expect(screen.queryByText('Chord Progression')).not.toBeInTheDocument();
  });

  it('does NOT render Chord Progression panel when chordProgression is empty array', () => {
    const blueprint = createMockBlueprint(true);
    blueprint.chordProgression = [];
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    expect(screen.queryByText('Chord Progression')).not.toBeInTheDocument();
  });

  it('renders progression summary when provided', () => {
    const blueprint = createMockBlueprint(true);
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    expect(screen.getByText('I - vi - IV - V7')).toBeInTheDocument();
  });

  it('renders all chord segments with correct data', () => {
    const blueprint = createMockBlueprint(true);
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    // Check chord names
    expect(screen.getByText('Cmaj')).toBeInTheDocument();
    expect(screen.getByText('Am')).toBeInTheDocument();
    expect(screen.getByText('Fmaj')).toBeInTheDocument();
    expect(screen.getByText('G7')).toBeInTheDocument();

    // Check qualities
    expect(screen.getByText('Major')).toBeInTheDocument();
    expect(screen.getByText('Minor')).toBeInTheDocument();
    expect(screen.getByText('Dominant 7th')).toBeInTheDocument();

    // Check time ranges
    expect(screen.getByText('0:00–0:04')).toBeInTheDocument();
    expect(screen.getByText('0:04–0:08')).toBeInTheDocument();
    expect(screen.getByText('0:08–0:12')).toBeInTheDocument();
    expect(screen.getByText('0:12–0:16')).toBeInTheDocument();
  });

  it('renders confidence values for each chord', () => {
    const blueprint = createMockBlueprint(true);
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    // Confidence percentages
    expect(screen.getByText('92%')).toBeInTheDocument(); // Cmaj
    expect(screen.getByText('88%')).toBeInTheDocument(); // Am
    expect(screen.getByText('85%')).toBeInTheDocument(); // Fmaj
    expect(screen.getByText('90%')).toBeInTheDocument(); // G7
  });

  it('renders chord progression panel in correct position (left column)', () => {
    const blueprint = createMockBlueprint(true);
    const { container } = render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    // Find the chord progression panel
    const chordPanel = screen.getByText('Chord Progression').closest('div.bg-zinc-900');
    expect(chordPanel).toBeInTheDocument();

    // It should be in the left column (lg:col-span-1)
    const leftColumn = container.querySelector('.lg\\:col-span-1');
    expect(leftColumn).toContainElement(chordPanel);
  });

  it('uses Music icon for chord progression panel', () => {
    const blueprint = createMockBlueprint(true);
    const { container } = render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    const chordHeader = screen.getByText('Chord Progression').closest('div');
    const musicIcon = chordHeader?.querySelector('svg');
    expect(musicIcon).toBeInTheDocument();
  });

  it('applies amber color theme to chord progression panel', () => {
    const blueprint = createMockBlueprint(true);
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    const summary = screen.getByText('I - vi - IV - V7');
    expect(summary).toHaveClass('text-amber-300');
  });

  it('renders without chord progression summary if not provided', () => {
    const blueprint = createMockBlueprint(true);
    delete blueprint.chordProgressionSummary;
    render(<BlueprintDisplay blueprint={blueprint} filename="test.wav" />);

    expect(screen.getByText('Chord Progression')).toBeInTheDocument();
    expect(screen.queryByText('I - vi - IV - V7')).not.toBeInTheDocument();
    
    // But chords should still render
    expect(screen.getByText('Cmaj')).toBeInTheDocument();
  });
});
