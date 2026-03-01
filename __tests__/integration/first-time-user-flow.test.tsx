import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

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

vi.mock('../../services/gemini', () => {
  return {
    GeminiProvider: class {
      name = 'Gemini';
      type = 'gemini' as const;
      async isAvailable(): Promise<boolean> {
        return false;
      }
      async analyze(): Promise<typeof fixtureBlueprint> {
        return fixtureBlueprint;
      }
    },
    GeminiChatService: class {
      async sendMessage() {
        return new ReadableStream();
      }
      clearHistory() {}
    },
    GEMINI_MODELS: [{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'stable' }],
    GEMINI_MODEL_LABELS: { 'gemini-2.5-flash': 'Gemini 2.5 Flash' },
  };
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

describe('App integration flow', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders idle upload state on first visit', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: /Sonic Architect/i })).toBeInTheDocument();
    expect(screen.getByText(/Ready to Deconstruct/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze track/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import audio stem/i })).toBeInTheDocument();
  });

  it('runs local analysis after file upload', async () => {
    const { container } = render(<App />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();

    const file = new File([new Uint8Array([1, 2, 3])], 'test.wav', {
      type: 'audio/wav',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(
      () => {
        expect(screen.getByText(/^Engine:\s+Local DSP$/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/Analyzed in 120ms/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ready to Deconstruct/i)).not.toBeInTheDocument();
  });

  it('ignores legacy first-time-user storage key', () => {
    localStorage.setItem(
      'sonic-architect-first-time',
      JSON.stringify({
        hasCompletedAnalysis: true,
        firstAnalysisDate: '2025-01-15T10:30:00.000Z',
        analysisCount: 1,
      })
    );

    render(<App />);

    expect(screen.getByText(/Ready to Deconstruct/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze track/i })).toBeInTheDocument();
  });

  it('hydrates provider preference from localStorage', () => {
    localStorage.setItem('sonic-architect-provider', 'local');

    render(<App />);
    expect(screen.getByText('Local DSP Engine')).toBeInTheDocument();
  });

  it('persists provider preference when user changes engine', () => {
    render(<App />);

    fireEvent.click(screen.getByLabelText(/analysis engine settings/i));
    fireEvent.click(screen.getByText('Gemini 2.5 Flash'));

    expect(localStorage.getItem('sonic-architect-provider')).toBe('gemini');
    expect(screen.getByText('Gemini 2.5 Flash')).toBeInTheDocument();
  });
});
