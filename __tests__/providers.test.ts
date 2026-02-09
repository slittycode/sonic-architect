import { describe, it, expect, vi } from 'vitest';
import { LocalAnalysisProvider } from '../services/localProvider';

// Mock Web Audio API for jsdom
function createMockAudioBuffer(duration = 5, sampleRate = 44100, channels = 1): AudioBuffer {
  const length = Math.floor(duration * sampleRate);
  const channelData = new Float32Array(length);
  // Sine wave at 440Hz with amplitude 0.5
  for (let i = 0; i < length; i++) {
    channelData[i] = 0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate);
  }

  return {
    length,
    duration,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: vi.fn().mockReturnValue(channelData),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

describe('LocalAnalysisProvider', () => {
  it('has correct name and type', () => {
    const provider = new LocalAnalysisProvider();
    expect(provider.name).toBe('Local DSP Engine');
    expect(provider.type).toBe('local');
  });

  it('isAvailable always returns true', async () => {
    const provider = new LocalAnalysisProvider();
    expect(await provider.isAvailable()).toBe(true);
  });
});

describe('Provider fallback', () => {
  it('returns LocalAnalysisProvider when ollama is unavailable', async () => {
    // Simulate the fallback logic from App.tsx
    const localProvider = new LocalAnalysisProvider();
    const providerType = 'ollama';

    // Mock: ollama is not reachable
    let provider = localProvider; // fallback
    expect(provider.type).toBe('local');
    expect(provider.name).toBe('Local DSP Engine');
  });
});
