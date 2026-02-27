import { describe, it, expect } from 'vitest';
import { extractMFCC } from '../mfcc';

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

/** Create a sine tone at a given frequency. */
function createSineBuffer(freq: number, durationSec: number, sampleRate = 44100): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = 0.8 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return createMockAudioBuffer([data], sampleRate);
}

/** Create white noise. */
function createNoiseBuffer(durationSec: number, sampleRate = 44100): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  // Simple PRNG for deterministic noise
  let seed = 42;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  return createMockAudioBuffer([data], sampleRate);
}

describe('MFCC extraction', () => {
  it('returns 13 mean coefficients', () => {
    const buffer = createSineBuffer(440, 1);
    const result = extractMFCC(buffer);

    expect(result.mean).toHaveLength(13);
    expect(result.stddev).toHaveLength(13);
    expect(result.numFrames).toBeGreaterThan(0);
  });

  it('returns finite values for all coefficients', () => {
    const buffer = createSineBuffer(440, 1);
    const result = extractMFCC(buffer);

    for (const v of result.mean) {
      expect(Number.isFinite(v)).toBe(true);
    }
    for (const v of result.stddev) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('produces different MFCCs for sine vs noise (timbral difference)', () => {
    const sine = createSineBuffer(440, 2);
    const noise = createNoiseBuffer(2);

    const sineMfcc = extractMFCC(sine);
    const noiseMfcc = extractMFCC(noise);

    // MFCCs should differ significantly — compute Euclidean distance
    let distSq = 0;
    for (let i = 0; i < 13; i++) {
      const diff = sineMfcc.mean[i] - noiseMfcc.mean[i];
      distSq += diff * diff;
    }
    const distance = Math.sqrt(distSq);

    // Timbral distance should be non-trivial
    expect(distance).toBeGreaterThan(1);
  });

  it('produces similar MFCCs for same timbre at different frequencies', () => {
    // Two sine tones — same timbre (pure tone), different pitch
    const sine440 = createSineBuffer(440, 2);
    const sine880 = createSineBuffer(880, 2);

    const mfcc440 = extractMFCC(sine440);
    const mfcc880 = extractMFCC(sine880);

    // Compare coefficients 1-12 (skip c0 which is energy/loudness sensitive).
    // Same timbre should produce more similar MFCCs than sine vs noise.
    let distSq = 0;
    for (let i = 1; i < 13; i++) {
      const diff = mfcc440.mean[i] - mfcc880.mean[i];
      distSq += diff * diff;
    }
    const sameTimbreDistance = Math.sqrt(distSq);

    // Compare against noise for reference
    const noise = createNoiseBuffer(2);
    const noiseMfcc = extractMFCC(noise);
    let noiseDist = 0;
    for (let i = 1; i < 13; i++) {
      const diff = mfcc440.mean[i] - noiseMfcc.mean[i];
      noiseDist += diff * diff;
    }
    const differentTimbreDistance = Math.sqrt(noiseDist);

    // Same timbre distance should be smaller than different timbre distance
    expect(sameTimbreDistance).toBeLessThan(differentTimbreDistance);
  });

  it('has low stddev for a stationary signal', () => {
    // A sustained sine is stationary — MFCCs should be consistent across frames
    const buffer = createSineBuffer(440, 2);
    const result = extractMFCC(buffer);

    // Stddev should be small relative to mean magnitude for a stationary tone
    for (let i = 0; i < 13; i++) {
      const ratio = Math.abs(result.mean[i]) > 0.01
        ? result.stddev[i] / Math.abs(result.mean[i])
        : result.stddev[i];
      // Variation should be less than 50% of mean (generous for FFT frame effects)
      expect(ratio).toBeLessThan(0.5);
    }
  });

  it('handles very short audio gracefully', () => {
    // Less than one full FFT frame
    const short = new Float32Array(1000);
    const buffer = createMockAudioBuffer([short], 44100);
    const result = extractMFCC(buffer);

    expect(result.mean).toHaveLength(13);
    expect(result.numFrames).toBeGreaterThanOrEqual(1);
  });
});
