import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { fixtureBlueprint, localAnalyzeAudioBuffer, ollamaIsAvailable, fakeAudioBuffer } =
  vi.hoisted(() => {
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
      localAnalyzeAudioBuffer: vi.fn(async () => fixtureBlueprintValue),
      ollamaIsAvailable: vi.fn(async () => false),
      fakeAudioBuffer: {
        sampleRate: 48000,
        numberOfChannels: 1,
        duration: 10,
        length: 480000,
        getChannelData: () => new Float32Array(480000),
      } as unknown as AudioBuffer,
    };
  });

vi.mock('../services/localProvider', () => {
  class LocalAnalysisProviderMock {
    name = 'Local DSP Engine';
    type = 'local' as const;
    async isAvailable(): Promise<boolean> {
      return true;
    }
    async analyze(): Promise<typeof fixtureBlueprint> {
      return fixtureBlueprint;
    }
    analyzeAudioBuffer = localAnalyzeAudioBuffer;
  }

  return { LocalAnalysisProvider: LocalAnalysisProviderMock };
});

vi.mock('../services/ollamaProvider', () => {
  class OllamaProviderMock {
    name = 'Local LLM (Ollama)';
    type = 'ollama' as const;
    async isAvailable(): Promise<boolean> {
      return ollamaIsAvailable();
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

vi.mock('../services/audioAnalysis', () => ({
  decodeAudioFile: vi.fn(async () => fakeAudioBuffer),
  extractWaveformPeaks: vi.fn(() => [0.2, 0.8, 0.4, 1]),
}));

vi.mock('../services/pitchDetection', () => ({
  detectPitches: vi.fn(async () => ({
    notes: [],
    confidence: 0,
    duration: 10,
    bpm: 120,
  })),
}));

import App from '../App';

describe('App provider fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('falls back to local analysis when ollama is selected but unavailable', async () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByLabelText(/analysis engine settings/i));
    fireEvent.click(screen.getByText('Ollama + Local DSP'));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    if (!fileInput) return;

    const file = new File([new Uint8Array([1, 2, 3])], 'demo.wav', {
      type: 'audio/wav',
    });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText(/Ollama not detected\. Using Local DSP Engine\./i)
      ).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Engine: Local DSP/i)).toBeInTheDocument();
    });

    expect(ollamaIsAvailable).toHaveBeenCalledTimes(1);
    expect(localAnalyzeAudioBuffer).toHaveBeenCalledTimes(1);
  });
});
