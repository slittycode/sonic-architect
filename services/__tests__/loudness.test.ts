import { describe, it, expect } from 'vitest';
import { measureLoudness } from '../loudness';

function createMockAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    getChannelData: (index: number) => channels[index],
  } as unknown as AudioBuffer;
}

/** Create a mono sine-wave AudioBuffer at the given amplitude. */
function createSineBuffer(
  amplitude: number,
  frequency: number = 1000,
  durationSec: number = 2,
  sampleRate: number = 48000,
  numChannels: number = 1
): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const channels: Float32Array[] = [];

  for (let c = 0; c < numChannels; c++) {
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      data[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
    channels.push(data);
  }

  return createMockAudioBuffer(channels, sampleRate);
}

/** Create a silent AudioBuffer. */
function createSilentBuffer(
  durationSec: number = 2,
  sampleRate: number = 48000
): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  return createMockAudioBuffer([new Float32Array(length)], sampleRate);
}

describe('loudness', () => {
  it('returns a valid LoudnessResult object', () => {
    const buffer = createSineBuffer(0.5);
    const result = measureLoudness(buffer);

    expect(result).toHaveProperty('lufsIntegrated');
    expect(result).toHaveProperty('truePeak');
    expect(result).toHaveProperty('shortTermLoudness');
    expect(typeof result.lufsIntegrated).toBe('number');
    expect(typeof result.truePeak).toBe('number');
  });

  it('measures louder signal as higher LUFS', () => {
    const quiet = measureLoudness(createSineBuffer(0.1));
    const loud = measureLoudness(createSineBuffer(0.8));

    expect(loud.lufsIntegrated).toBeGreaterThan(quiet.lufsIntegrated);
  });

  it('measures silence as very low LUFS', () => {
    const result = measureLoudness(createSilentBuffer());
    expect(result.lufsIntegrated).toBeLessThanOrEqual(-70);
  });

  it('measures true peak correctly for a full-scale sine', () => {
    const result = measureLoudness(createSineBuffer(1.0));
    // True peak of a 1.0 amplitude sine should be near 0 dBTP
    expect(result.truePeak).toBeGreaterThan(-1);
    expect(result.truePeak).toBeLessThanOrEqual(0.5);
  });

  it('handles stereo buffers', () => {
    const buffer = createSineBuffer(0.5, 1000, 2, 48000, 2);
    const result = measureLoudness(buffer);

    // Stereo with identical channels sums energy: expect ~3 dB louder than mono
    // (BS.1770 sums weighted mean-square per channel, so 2 identical channels = 2x energy = +3dB)
    const monoResult = measureLoudness(createSineBuffer(0.5));
    const diff = result.lufsIntegrated - monoResult.lufsIntegrated;
    expect(diff).toBeGreaterThan(2);
    expect(diff).toBeLessThan(4);
  });

  it('produces short-term loudness values for longer audio', () => {
    // 10 seconds should produce multiple short-term (3s) measurements
    const buffer = createSineBuffer(0.5, 1000, 10);
    const result = measureLoudness(buffer);

    expect(result.shortTermLoudness.length).toBeGreaterThan(0);
  });

  it('full-scale 1kHz sine measures in expected LUFS range', () => {
    // A full-scale 1 kHz sine at 48 kHz should measure roughly -3.01 LUFS
    // (K-weighting is flat at 1 kHz, but the pre-filter adds ~0 dB there).
    // Allow a wider tolerance since our biquad coefficients are approximate.
    const result = measureLoudness(createSineBuffer(1.0, 1000, 5));
    expect(result.lufsIntegrated).toBeGreaterThan(-6);
    expect(result.lufsIntegrated).toBeLessThan(0);
  });
});
