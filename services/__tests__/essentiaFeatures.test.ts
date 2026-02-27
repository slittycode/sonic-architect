import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the Essentia.js WASM feature extraction wrapper.
 *
 * Since Essentia.js requires native WASM binaries (unavailable in jsdom),
 * we mock the 'essentia.js' module entirely and verify our wrapper's
 * frame-averaging logic and output shape.
 *
 * vi.mock() is hoisted to the top of the file by Vitest's transform — meaning
 * the factory runs before any module-level `const` declarations. We use
 * vi.hoisted() so that mockMethods is created before hoisting occurs and is
 * safely referenceable inside the factory.
 */

const mockMethods = vi.hoisted(() => ({
  arrayToVector: vi.fn((arr: Float32Array) => arr),
  ZeroCrossingRate: vi.fn(() => ({ zeroCrossingRate: 0.15 })),
  Windowing: vi.fn((frame: Float32Array) => ({ frame })),
  Spectrum: vi.fn((frame: Float32Array) => ({ spectrum: frame })),
  HFC: vi.fn(() => ({ hfc: 0.6 })),
  SpectralComplexity: vi.fn(() => ({ spectralComplexity: 4.2 })),
  SpectralPeaks: vi.fn(() => ({
    frequencies: new Float32Array([440, 880]),
    magnitudes: new Float32Array([0.8, 0.4]),
  })),
  Dissonance: vi.fn(() => ({ dissonance: 0.3 })),
}));

vi.mock('essentia.js', () => {
  // Must use a real class so `new Essentia(EssentiaWASM)` works correctly.
  class MockEssentia {
    constructor() {
      Object.assign(this, mockMethods);
    }
  }
  return { Essentia: MockEssentia, EssentiaWASM: {} };
});

import { extractEssentiaFeatures } from '../essentiaFeatures';

function createMockAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    getChannelData: (index: number) => channels[index] ?? new Float32Array(0),
  } as unknown as AudioBuffer;
}

describe('extractEssentiaFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default return values after clearAllMocks resets them.
    mockMethods.ZeroCrossingRate.mockReturnValue({ zeroCrossingRate: 0.15 });
    mockMethods.HFC.mockReturnValue({ hfc: 0.6 });
    mockMethods.SpectralComplexity.mockReturnValue({ spectralComplexity: 4.2 });
    mockMethods.Dissonance.mockReturnValue({ dissonance: 0.3 });
  });

  it('returns a valid EssentiaFeatureResult object', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(8192)], 44100);
    const result = await extractEssentiaFeatures(buffer);

    expect(result).toHaveProperty('dissonance');
    expect(result).toHaveProperty('hfc');
    expect(result).toHaveProperty('spectralComplexity');
    expect(result).toHaveProperty('zeroCrossingRate');
  });

  it('returns all numeric values', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(8192)], 44100);
    const result = await extractEssentiaFeatures(buffer);

    expect(typeof result.dissonance).toBe('number');
    expect(typeof result.hfc).toBe('number');
    expect(typeof result.spectralComplexity).toBe('number');
    expect(typeof result.zeroCrossingRate).toBe('number');
  });

  it('returns mock values averaged across frames', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(8192)], 44100);
    const result = await extractEssentiaFeatures(buffer);

    // Mock always returns: zeroCrossingRate=0.15, hfc=0.6, spectralComplexity=4.2, dissonance=0.3
    expect(result.zeroCrossingRate).toBeCloseTo(0.15, 2);
    expect(result.hfc).toBeCloseTo(0.6, 2);
    expect(result.spectralComplexity).toBeCloseTo(4.2, 2);
    expect(result.dissonance).toBeCloseTo(0.3, 2);
  });

  it('returns zeros for audio too short for any frames (< 2048 samples)', async () => {
    const short = createMockAudioBuffer([new Float32Array(512)], 44100);
    const result = await extractEssentiaFeatures(short);

    expect(result.dissonance).toBe(0);
    expect(result.hfc).toBe(0);
    expect(result.spectralComplexity).toBe(0);
    expect(result.zeroCrossingRate).toBe(0);
  });

  it('returns zeros for silent buffer (if Essentia returns 0s)', async () => {
    mockMethods.ZeroCrossingRate.mockReturnValue({ zeroCrossingRate: 0 });
    mockMethods.HFC.mockReturnValue({ hfc: 0 });
    mockMethods.SpectralComplexity.mockReturnValue({ spectralComplexity: 0 });
    mockMethods.Dissonance.mockReturnValue({ dissonance: 0 });

    const buffer = createMockAudioBuffer([new Float32Array(8192)], 44100);
    const result = await extractEssentiaFeatures(buffer);

    expect(result.dissonance).toBe(0);
    expect(result.hfc).toBe(0);
    expect(result.spectralComplexity).toBe(0);
    expect(result.zeroCrossingRate).toBe(0);
  });

  it('calls Essentia ZeroCrossingRate and HFC for each frame', async () => {
    const frameSize = 2048;
    const hopSize = 1024;
    const totalSamples = 8192;
    const expectedFrames = Math.floor((totalSamples - frameSize) / hopSize) + 1;

    const buffer = createMockAudioBuffer([new Float32Array(totalSamples)], 44100);
    await extractEssentiaFeatures(buffer);

    expect(mockMethods.ZeroCrossingRate).toHaveBeenCalledTimes(expectedFrames);
    expect(mockMethods.HFC).toHaveBeenCalledTimes(expectedFrames);
  });
});
