import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { fixtureBlueprint, fakeAudioBuffer } = vi.hoisted(() => {
  const fixtureBlueprintValue = {
    telemetry: {
      bpm: '128',
      key: 'F# Minor',
      groove: 'Steady groove',
      bpmConfidence: 0.9,
      keyConfidence: 0.8,
    },
    arrangement: [
      {
        timeRange: '0:00–0:30',
        label: 'Intro',
        description: 'Intro section',
      },
    ],
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
      analysisTime: 120,
      sampleRate: 48000,
      duration: 10,
      channels: 2,
    },
  };

  return {
    fixtureBlueprint: fixtureBlueprintValue,
    fakeAudioBuffer: {
      sampleRate: 48000,
      numberOfChannels: 1,
      duration: 10,
      length: 480000,
      getChannelData: () => new Float32Array(480000),
    } as unknown as AudioBuffer,
  };
});

vi.mock('../../services/localProvider', () => {
  class LocalAnalysisProviderMock {
    name = 'Local DSP Engine';
    type = 'local' as const;
    async isAvailable(): Promise<boolean> {
      return true;
    }
    async analyze(): Promise<typeof fixtureBlueprint> {
      return fixtureBlueprint;
    }
    async analyzeAudioBuffer(): Promise<typeof fixtureBlueprint> {
      return fixtureBlueprint;
    }
  }

  return { LocalAnalysisProvider: LocalAnalysisProviderMock };
});

vi.mock('../../services/ollamaProvider', () => {
  class OllamaProviderMock {
    name = 'Local LLM (Ollama)';
    type = 'ollama' as const;
    async isAvailable(): Promise<boolean> {
      return false;
    }
    async analyze(): Promise<typeof fixtureBlueprint> {
      return fixtureBlueprint;
    }
    async analyzeAudioBuffer(): Promise<typeof fixtureBlueprint> {
      return fixtureBlueprint;
    }
  }

  return { OllamaProvider: OllamaProviderMock };
});

vi.mock('../../services/audioAnalysis', () => ({
  decodeAudioFile: vi.fn(async () => fakeAudioBuffer),
  extractWaveformPeaks: vi.fn(() => [0.2, 0.8, 0.4, 1]),
}));

vi.mock('../../services/pitchDetection', () => ({
  detectPitches: vi.fn(async () => ({
    notes: [],
    confidence: 0,
    duration: 10,
    bpm: 120,
  })),
}));

import App from '../../App';

describe('First-time user flow integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows expanded hero on first visit', () => {
    render(<App />);

    // Hero should be expanded
    expect(screen.getByText(/Deconstruct Any Track into an/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/MIDI Transcription/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument();
  });

  it('collapses hero after first successful analysis', async () => {
    const { container } = render(<App />);

    // Verify hero is expanded initially
    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();

    // Upload a file
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File([new Uint8Array([1, 2, 3])], 'test.wav', {
      type: 'audio/wav',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for analysis to complete
    await waitFor(
      () => {
        expect(screen.getByText(/Engine: Local DSP/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Hero should now be minimized (feature highlights not visible)
    expect(screen.queryByText(/Local Analysis/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();

    // But minimized version should still show
    expect(screen.getByText(/Deconstruct Any Track into an Ableton Live Blueprint/i)).toBeInTheDocument();
  });

  it('shows minimized hero on subsequent visits', () => {
    // Simulate returning user
    localStorage.setItem(
      'sonic-architect-first-time',
      JSON.stringify({
        hasCompletedAnalysis: true,
        firstAnalysisDate: '2025-01-15T10:30:00.000Z',
        analysisCount: 1,
      })
    );

    render(<App />);

    // Hero should be minimized
    expect(screen.queryByText(/Local Analysis/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get started/i })).not.toBeInTheDocument();

    // Minimized version should show
    expect(screen.getByText(/Deconstruct Any Track into an Ableton Live Blueprint/i)).toBeInTheDocument();
  });

  it('persists first-time user state in localStorage', async () => {
    const { container } = render(<App />);

    // Verify localStorage is initially empty or default
    const initialState = localStorage.getItem('sonic-architect-first-time');
    if (initialState) {
      const parsed = JSON.parse(initialState);
      expect(parsed.hasCompletedAnalysis).toBe(false);
    }

    // Upload and analyze
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'test.wav', {
      type: 'audio/wav',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for analysis to complete
    await waitFor(
      () => {
        expect(screen.getByText(/Engine: Local DSP/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Verify localStorage was updated
    const storedState = localStorage.getItem('sonic-architect-first-time');
    expect(storedState).not.toBeNull();

    const parsed = JSON.parse(storedState!);
    expect(parsed.hasCompletedAnalysis).toBe(true);
    expect(parsed.analysisCount).toBeGreaterThan(0);
    expect(parsed.firstAnalysisDate).not.toBeNull();
  });

  it('can toggle hero between expanded and minimized states', () => {
    render(<App />);

    // Initially expanded
    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();

    // Click minimize
    const minimizeButton = screen.getByLabelText(/minimize hero section/i);
    fireEvent.click(minimizeButton);

    // Should be minimized
    expect(screen.queryByText(/Local Analysis/i)).not.toBeInTheDocument();

    // Click expand
    const expandButton = screen.getByLabelText(/expand hero section/i);
    fireEvent.click(expandButton);

    // Should be expanded again
    expect(screen.getByText(/Local Analysis/i)).toBeInTheDocument();
  });
});
