import { describe, it, expect } from 'vitest';
import { detectAcidPattern } from '../acidDetection';

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

/** Non-acid bass: steady 200Hz sine without centroid oscillation. */
function createSteadyBassBuffer(sampleRate = 44100, durationSamples = 44100): AudioBuffer {
  const data = new Float32Array(durationSamples);
  for (let i = 0; i < durationSamples; i++) {
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * 200 * t) * 0.5;
  }
  return createMockAudioBuffer([data], sampleRate);
}

/**
 * Acid-like buffer: bass band signal where the spectral content oscillates in frequency
 * (simulating a 303 filter sweep). Energy alternates between low and high sub-bass bands.
 */
function createAcidLikeBassBuffer(sampleRate = 44100, durationSamples = 88200): AudioBuffer {
  const data = new Float32Array(durationSamples);
  const bpm = 120;
  const beatInterval = (60 / bpm) * sampleRate;

  // Alternating between low bass (150Hz) and high bass (600Hz) to create centroid oscillation
  // This simulates an open/closed 303 filter in an 8th-note pattern
  for (let i = 0; i < durationSamples; i++) {
    const t = i / sampleRate;
    const beatPhase = (i % beatInterval) / beatInterval;
    const freq = beatPhase < 0.5 ? 150 : 600; // oscillate between two frequencies
    data[i] = Math.sin(2 * Math.PI * freq * t) * 0.7;
  }
  return createMockAudioBuffer([data], sampleRate);
}

describe('detectAcidPattern', () => {
  it('returns a valid AcidDetectionResult object', () => {
    const buffer = createSteadyBassBuffer();
    const result = detectAcidPattern(buffer, 120);

    expect(result).toHaveProperty('isAcid');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('resonanceLevel');
    expect(result).toHaveProperty('centroidOscillationHz');
    expect(result).toHaveProperty('bassRhythmDensity');
  });

  it('returns confidence and resonanceLevel in [0, 1] range', () => {
    const buffer = createSteadyBassBuffer();
    const result = detectAcidPattern(buffer, 120);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.resonanceLevel).toBeGreaterThanOrEqual(0);
    expect(result.resonanceLevel).toBeLessThanOrEqual(1);
  });

  it('isAcid is a boolean', () => {
    const buffer = createSteadyBassBuffer();
    const result = detectAcidPattern(buffer, 120);
    expect(typeof result.isAcid).toBe('boolean');
  });

  it('returns safe defaults for very short audio (< 10 analysis frames)', () => {
    const short = createMockAudioBuffer([new Float32Array(512)], 44100);
    const result = detectAcidPattern(short, 120);

    expect(result.isAcid).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.resonanceLevel).toBe(0);
  });

  it('returns isAcid: false for silence', () => {
    const silent = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = detectAcidPattern(silent, 120);
    expect(result.isAcid).toBe(false);
  });

  it('returns higher centroidOscillationHz for sweeping bass than steady bass', () => {
    const steady = detectAcidPattern(createSteadyBassBuffer(), 120);
    const sweeping = detectAcidPattern(createAcidLikeBassBuffer(), 120);

    expect(sweeping.centroidOscillationHz).toBeGreaterThan(steady.centroidOscillationHz);
  });

  it('returns higher confidence for acid-like signal than steady bass', () => {
    const steady = detectAcidPattern(createSteadyBassBuffer(), 120);
    const acid = detectAcidPattern(createAcidLikeBassBuffer(), 120);

    expect(acid.confidence).toBeGreaterThan(steady.confidence);
  });

  it('returns bassRhythmDensity >= 0', () => {
    const buffer = createAcidLikeBassBuffer();
    const result = detectAcidPattern(buffer, 120);
    expect(result.bassRhythmDensity).toBeGreaterThanOrEqual(0);
  });
});
