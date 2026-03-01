import { describe, it, expect } from 'vitest';
import { analyzeKickDistortion, KickAnalysisResult } from '../kickAnalysis';

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

/**
 * Creates a buffer with kick-like energy bursts (50Hz sine pulses at regular intervals).
 *
 * Kicks start at beat 1 (after one beat of silence) so the energy envelope has
 * a clear rising edge before each transient — required by the peak detector.
 * Each kick uses a linear attack followed by exponential decay, creating a
 * well-defined local maximum in the FFT energy envelope.
 */
function createCleanKickBuffer(sampleRate = 44100, bpm = 120): AudioBuffer {
  const beatInterval = (60 / bpm) * sampleRate;
  const numKicks = 6;
  // Start at beat 1 — leaves one beat of silence so each onset has a clear rising edge
  const totalSamples = Math.ceil(beatInterval * (numKicks + 2));
  const data = new Float32Array(totalSamples);
  const attackSamples = 512; // ~12ms linear attack for a detectable onset

  for (let k = 1; k <= numKicks; k++) {
    const kickStart = Math.round(k * beatInterval);
    const kickLen = Math.min(4096, totalSamples - kickStart);
    for (let i = 0; i < kickLen; i++) {
      const t = i / sampleRate;
      const amp =
        i < attackSamples ? i / attackSamples : Math.exp((-(i - attackSamples) / sampleRate) * 30);
      // Pure 50Hz sine — low harmonic content → low THD
      data[kickStart + i] = amp * Math.sin(2 * Math.PI * 50 * t);
    }
  }
  return createMockAudioBuffer([data], sampleRate);
}

/**
 * Creates a buffer with harmonic-rich kick bursts to simulate distortion.
 * Adds 2nd–5th harmonics at comparable amplitude to the fundamental.
 * Same onset structure as the clean buffer so transient detection is comparable.
 */
function createDistortedKickBuffer(sampleRate = 44100, bpm = 120): AudioBuffer {
  const beatInterval = (60 / bpm) * sampleRate;
  const numKicks = 6;
  const totalSamples = Math.ceil(beatInterval * (numKicks + 2));
  const data = new Float32Array(totalSamples);
  const attackSamples = 512;

  for (let k = 1; k <= numKicks; k++) {
    const kickStart = Math.round(k * beatInterval);
    const kickLen = Math.min(4096, totalSamples - kickStart);
    for (let i = 0; i < kickLen; i++) {
      const t = i / sampleRate;
      const amp =
        i < attackSamples ? i / attackSamples : Math.exp((-(i - attackSamples) / sampleRate) * 30);
      // Fundamental + heavy harmonics (simulating heavy saturation)
      data[kickStart + i] =
        amp *
        (Math.sin(2 * Math.PI * 50 * t) * 0.4 +
          Math.sin(2 * Math.PI * 100 * t) * 0.25 +
          Math.sin(2 * Math.PI * 150 * t) * 0.15 +
          Math.sin(2 * Math.PI * 200 * t) * 0.12 +
          Math.sin(2 * Math.PI * 250 * t) * 0.08);
    }
  }
  return createMockAudioBuffer([data], sampleRate);
}

describe('analyzeKickDistortion', () => {
  it('returns a valid KickAnalysisResult object', () => {
    const buffer = createCleanKickBuffer();
    const result = analyzeKickDistortion(buffer, 120);

    expect(result).toHaveProperty('isDistorted');
    expect(result).toHaveProperty('thd');
    expect(result).toHaveProperty('harmonicRatio');
    expect(result).toHaveProperty('fundamentalHz');
    expect(result).toHaveProperty('kickCount');
  });

  it('returns thd and harmonicRatio in [0, 1] range', () => {
    const buffer = createCleanKickBuffer();
    const result = analyzeKickDistortion(buffer, 120);

    expect(result.thd).toBeGreaterThanOrEqual(0);
    expect(result.thd).toBeLessThanOrEqual(1);
    expect(result.harmonicRatio).toBeGreaterThanOrEqual(0);
    expect(result.harmonicRatio).toBeLessThanOrEqual(1);
  });

  it('isDistorted is a boolean', () => {
    const buffer = createCleanKickBuffer();
    const result = analyzeKickDistortion(buffer, 120);
    expect(typeof result.isDistorted).toBe('boolean');
  });

  it('returns kickCount >= 0', () => {
    const buffer = createCleanKickBuffer();
    const result = analyzeKickDistortion(buffer, 120);
    expect(result.kickCount).toBeGreaterThanOrEqual(0);
  });

  it('returns safe defaults for very short audio (< 2 kicks detectable)', () => {
    const short = createMockAudioBuffer([new Float32Array(256)], 44100);
    const result = analyzeKickDistortion(short, 120);

    expect(result.isDistorted).toBe(false);
    expect(result.thd).toBeGreaterThanOrEqual(0);
    expect(result.thd).toBeLessThanOrEqual(1);
  });

  it('returns safe defaults for silence', () => {
    const silent = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = analyzeKickDistortion(silent, 120);

    expect(result.isDistorted).toBe(false);
    expect(result.kickCount).toBe(0);
  });

  it('detects higher THD for a distorted kick than a clean kick', () => {
    const clean = analyzeKickDistortion(createCleanKickBuffer(), 120);
    const distorted = analyzeKickDistortion(createDistortedKickBuffer(), 120);

    // Distorted kick must have more harmonic content
    expect(distorted.thd).toBeGreaterThan(clean.thd);
  });

  it('classifies distorted kick as isDistorted: true', () => {
    const result = analyzeKickDistortion(createDistortedKickBuffer(), 120);
    expect(result.isDistorted).toBe(true);
  });
});
