import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import EnhancedAnalysisPanel from '../../components/EnhancedAnalysisPanel';
import { GlobalTelemetry } from '../../types';

/** Full telemetry fixture with all 8 enhanced analysis fields populated. */
const fullTelemetry: GlobalTelemetry = {
  bpm: '128',
  key: 'C Minor',
  groove: 'Straight 4/4',
  enhancedGenre: 'techno',
  genreFamily: 'techno',
  secondaryGenre: 'minimal-techno',
  sidechainAnalysis: { hasSidechain: true, strength: 0.75 },
  bassAnalysis: { decayMs: 220, type: 'punchy', transientRatio: 0.8 },
  swingAnalysis: { swingPercent: 5, grooveType: 'straight' },
  acidAnalysis: { isAcid: false, confidence: 0.1, resonanceLevel: 0.2 },
  reverbAnalysis: { rt60: 0.3, isWet: false, tailEnergyRatio: 0.15 },
  kickAnalysis: { isDistorted: false, thd: 0.05, harmonicRatio: 0.9 },
  supersawAnalysis: { isSupersaw: false, confidence: 0.05, voiceCount: 0 },
  vocalAnalysis: { hasVocals: false, confidence: 0.1, vocalEnergyRatio: 0.1 },
};

/** Partial telemetry with only sidechain data. */
const partialTelemetry: GlobalTelemetry = {
  bpm: '130',
  key: 'A Minor',
  groove: 'Straight 4/4',
  sidechainAnalysis: { hasSidechain: true, strength: 0.9 },
};

/** Telemetry with no enhanced analysis data (all optional fields absent). */
const emptyTelemetry: GlobalTelemetry = {
  bpm: '120',
  key: 'G Major',
  groove: 'Straight 4/4',
};

describe('EnhancedAnalysisPanel', () => {
  it('renders the Enhanced Sonic Analysis header', () => {
    render(<EnhancedAnalysisPanel telemetry={fullTelemetry} />);
    expect(screen.getByText(/Enhanced Sonic Analysis/i)).toBeInTheDocument();
  });

  it('renders all 8 analysis card titles when all telemetry fields are present', () => {
    render(<EnhancedAnalysisPanel telemetry={fullTelemetry} />);

    expect(screen.getByText(/Sidechain Pump/i)).toBeInTheDocument();
    // Use heading role to avoid matching the description paragraph that also contains "bass decay"
    expect(screen.getByRole('heading', { level: 4, name: /Bass Decay/i })).toBeInTheDocument();
    expect(screen.getByText(/Groove\/Swing/i)).toBeInTheDocument();
    expect(screen.getByText(/Acid\/303/i)).toBeInTheDocument();
    expect(screen.getByText(/Reverb Tail/i)).toBeInTheDocument();
    expect(screen.getByText(/Kick Distortion/i)).toBeInTheDocument();
    expect(screen.getByText(/Supersaw Detection/i)).toBeInTheDocument();
    expect(screen.getByText(/Vocal Detection/i)).toBeInTheDocument();
  });

  it('renders genre classification summary when enhancedGenre is present', () => {
    render(<EnhancedAnalysisPanel telemetry={fullTelemetry} />);
    expect(screen.getByText(/Genre Classification Summary/i)).toBeInTheDocument();
    // Both Primary Genre and Genre Family show 'techno' — getAllByText handles multiple matches
    expect(screen.getAllByText('techno')[0]).toBeInTheDocument();
  });

  it('renders only the sidechain card when only sidechainAnalysis is present', () => {
    render(<EnhancedAnalysisPanel telemetry={partialTelemetry} />);

    expect(screen.getByText(/Sidechain Pump/i)).toBeInTheDocument();
    expect(screen.queryByText(/Bass Decay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Acid\/303/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vocal Detection/i)).not.toBeInTheDocument();
  });

  it('renders empty state when no enhanced data is present', () => {
    render(<EnhancedAnalysisPanel telemetry={emptyTelemetry} />);
    expect(screen.getByText(/Enhanced analysis data not available/i)).toBeInTheDocument();
  });

  it('does not render genre summary when enhancedGenre and genreFamily are absent', () => {
    render(<EnhancedAnalysisPanel telemetry={partialTelemetry} />);
    expect(screen.queryByText(/Genre Classification Summary/i)).not.toBeInTheDocument();
  });

  it('shows "Detected" badge when sidechain is present', () => {
    const telemetryWithSidechain: GlobalTelemetry = {
      ...emptyTelemetry,
      sidechainAnalysis: { hasSidechain: true, strength: 0.8 },
    };
    render(<EnhancedAnalysisPanel telemetry={telemetryWithSidechain} />);
    expect(screen.getByText(/Detected/i)).toBeInTheDocument();
  });

  it('shows "Not Detected" badge when sidechain is absent', () => {
    const telemetryNoSidechain: GlobalTelemetry = {
      ...emptyTelemetry,
      sidechainAnalysis: { hasSidechain: false, strength: 0.1 },
    };
    render(<EnhancedAnalysisPanel telemetry={telemetryNoSidechain} />);
    expect(screen.getByText(/Not Detected/i)).toBeInTheDocument();
  });

  it('renders bass decay type label', () => {
    const telemetry: GlobalTelemetry = {
      ...emptyTelemetry,
      bassAnalysis: { decayMs: 150, type: 'punchy', transientRatio: 0.9 },
    };
    render(<EnhancedAnalysisPanel telemetry={telemetry} />);
    // Exact string match targets only the <span> type label, not the description paragraph
    expect(screen.getByText('punchy')).toBeInTheDocument();
  });

  it('shows "Acid Detected" for acid=true signal', () => {
    const telemetry: GlobalTelemetry = {
      ...emptyTelemetry,
      acidAnalysis: { isAcid: true, confidence: 0.8, resonanceLevel: 0.7 },
    };
    render(<EnhancedAnalysisPanel telemetry={telemetry} />);
    expect(screen.getByText(/Acid Detected/i)).toBeInTheDocument();
  });

  it('shows vocal status indicator', () => {
    const withVocals: GlobalTelemetry = {
      ...emptyTelemetry,
      vocalAnalysis: { hasVocals: true, confidence: 0.75, vocalEnergyRatio: 0.4 },
    };
    render(<EnhancedAnalysisPanel telemetry={withVocals} />);
    expect(screen.getByText(/Vocals/i)).toBeInTheDocument();
  });

  it('shows secondary genre when present in summary', () => {
    const withSecondary: GlobalTelemetry = {
      ...fullTelemetry,
      secondaryGenre: 'minimal-techno',
    };
    render(<EnhancedAnalysisPanel telemetry={withSecondary} />);
    // Hyphens are replaced with spaces for display: 'minimal-techno' → 'minimal techno'
    expect(screen.getByText('minimal techno')).toBeInTheDocument();
  });
});
