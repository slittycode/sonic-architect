import { describe, it, expect } from 'vitest';
import { detectVocals } from '../vocalDetection';

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
 * Signal with energy concentrated at the three vocal formant frequencies
 * (500Hz, 1500Hz, 2500Hz). Triggers both vocalEnergyRatio and formantStrength.
 */
function createVocalBuffer(sampleRate = 44100, durationSamples = 44100): AudioBuffer {
  const data = new Float32Array(durationSamples);
  const formants = [500, 1500, 2500];
  for (let i = 0; i < durationSamples; i++) {
    const t = i / sampleRate;
    for (const f of formants) {
      data[i] += Math.sin(2 * Math.PI * f * t) / formants.length;
    }
  }
  return createMockAudioBuffer([data], sampleRate);
}

/**
 * Signal with energy only in sub-bass (50Hz) — no overlap with vocal frequency range.
 */
function createSubBassBuffer(sampleRate = 44100, durationSamples = 44100): AudioBuffer {
  const data = new Float32Array(durationSamples);
  for (let i = 0; i < durationSamples; i++) {
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * 50 * t);
  }
  return createMockAudioBuffer([data], sampleRate);
}

describe('detectVocals', () => {
  it('returns a valid VocalDetectionResult object', () => {
    const buffer = createVocalBuffer();
    const result = detectVocals(buffer);

    expect(result).toHaveProperty('hasVocals');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('vocalEnergyRatio');
    expect(result).toHaveProperty('formantStrength');
    expect(result).toHaveProperty('mfccLikelihood');
  });

  it('returns all numeric fields in [0, 1] range', () => {
    const buffer = createVocalBuffer();
    const result = detectVocals(buffer);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.vocalEnergyRatio).toBeGreaterThanOrEqual(0);
    expect(result.vocalEnergyRatio).toBeLessThanOrEqual(1);
    expect(result.formantStrength).toBeGreaterThanOrEqual(0);
    expect(result.formantStrength).toBeLessThanOrEqual(1);
    expect(result.mfccLikelihood).toBeGreaterThanOrEqual(0);
    expect(result.mfccLikelihood).toBeLessThanOrEqual(1);
  });

  it('hasVocals is a boolean', () => {
    const buffer = createVocalBuffer();
    const result = detectVocals(buffer);
    expect(typeof result.hasVocals).toBe('boolean');
  });

  it('returns vocalEnergyRatio = 0 for silence', () => {
    const silent = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = detectVocals(silent);
    expect(result.vocalEnergyRatio).toBe(0);
  });

  it('returns hasVocals: false for silence', () => {
    const silent = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = detectVocals(silent);
    expect(result.hasVocals).toBe(false);
  });

  it('returns mfccLikelihood = 0.5 when no MFCC provided (neutral default)', () => {
    const buffer = createVocalBuffer();
    const result = detectVocals(buffer);
    expect(result.mfccLikelihood).toBe(0.5);
  });

  it('returns higher vocalEnergyRatio for vocal-range signal than sub-bass signal', () => {
    const vocalResult = detectVocals(createVocalBuffer());
    const bassResult = detectVocals(createSubBassBuffer());
    expect(vocalResult.vocalEnergyRatio).toBeGreaterThan(bassResult.vocalEnergyRatio);
  });

  it('detects formant structure in signal with vocal formant frequencies', () => {
    const result = detectVocals(createVocalBuffer());
    // Formant frequencies (500, 1500, 2500Hz) should be detectable
    expect(result.formantStrength).toBeGreaterThan(0);
  });

  it('detects vocals in a signal with formant structure at 500, 1500, 2500Hz', () => {
    const result = detectVocals(createVocalBuffer());
    expect(result.hasVocals).toBe(true);
  });

  it('does not detect vocals in sub-bass-only signal', () => {
    const result = detectVocals(createSubBassBuffer());
    expect(result.hasVocals).toBe(false);
  });

  it('uses provided MFCC to compute mfccLikelihood', () => {
    const buffer = createVocalBuffer();
    // Ideal vocal MFCC pattern: ~40% low, ~35% mid, ~25% high
    const vocalMfcc = [0, 4, 4, 4, 3.5, 3.5, 3.5, 3.5, 3.5, 2.5, 2.5, 2.5, 2.5];
    const resultWithMfcc = detectVocals(buffer, vocalMfcc);
    const resultWithoutMfcc = detectVocals(buffer);
    // With MFCC provided, mfccLikelihood should differ from the default 0.5
    expect(resultWithMfcc.mfccLikelihood).not.toBe(resultWithoutMfcc.mfccLikelihood);
  });
});
