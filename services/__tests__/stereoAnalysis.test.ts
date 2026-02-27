import { describe, it, expect } from 'vitest';
import { analyzeStereoField } from '../stereoAnalysis';

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

function createStereoSineBuffer(
  amplitudeL: number,
  amplitudeR: number,
  frequency: number = 1000,
  durationSec: number = 2,
  sampleRate: number = 48000,
  phaseOffsetR: number = 0
): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = (2 * Math.PI * frequency * i) / sampleRate;
    left[i] = amplitudeL * Math.sin(t);
    right[i] = amplitudeR * Math.sin(t + phaseOffsetR);
  }

  return createMockAudioBuffer([left, right], sampleRate);
}

describe('stereoAnalysis', () => {
  it('returns mono result for single-channel audio', () => {
    const length = 48000 * 2;
    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      mono[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }
    const buffer = createMockAudioBuffer([mono], 48000);
    const result = analyzeStereoField(buffer);

    expect(result.phaseCorrelation).toBe(1);
    expect(result.stereoWidth).toBe(0);
    expect(result.monoCompatible).toBe(true);
  });

  it('detects identical L/R as perfectly correlated (mono)', () => {
    const buffer = createStereoSineBuffer(0.8, 0.8, 1000, 2, 48000, 0);
    const result = analyzeStereoField(buffer);

    expect(result.phaseCorrelation).toBeGreaterThan(0.95);
    expect(result.stereoWidth).toBeLessThan(0.05);
    expect(result.monoCompatible).toBe(true);
  });

  it('detects out-of-phase stereo (inverted right channel)', () => {
    // Phase offset of π = inverted
    const buffer = createStereoSineBuffer(0.8, 0.8, 1000, 2, 48000, Math.PI);
    const result = analyzeStereoField(buffer);

    expect(result.phaseCorrelation).toBeLessThan(-0.9);
    expect(result.stereoWidth).toBeGreaterThan(0.9);
    expect(result.monoCompatible).toBe(false);
  });

  it('detects uncorrelated stereo (90° phase offset)', () => {
    const buffer = createStereoSineBuffer(0.8, 0.8, 1000, 2, 48000, Math.PI / 2);
    const result = analyzeStereoField(buffer);

    // 90° offset → correlation near 0
    expect(result.phaseCorrelation).toBeGreaterThan(-0.1);
    expect(result.phaseCorrelation).toBeLessThan(0.1);
    expect(result.stereoWidth).toBeGreaterThan(0.4);
  });

  it('provides per-band analysis for all 7 bands', () => {
    const buffer = createStereoSineBuffer(0.8, 0.8, 1000, 2, 48000, 0);
    const result = analyzeStereoField(buffer);

    expect(result.bandAnalysis).toHaveLength(7);
    expect(result.bandAnalysis[0].name).toBe('Sub Bass');
    expect(result.bandAnalysis[6].name).toBe('Brilliance');

    for (const band of result.bandAnalysis) {
      expect(band.correlation).toBeGreaterThanOrEqual(-1);
      expect(band.correlation).toBeLessThanOrEqual(1);
      expect(typeof band.balanceDb).toBe('number');
      expect(typeof band.phaseCancellationRisk).toBe('boolean');
    }
  });

  it('detects left-heavy balance', () => {
    // Left at full volume, right at half
    const buffer = createStereoSineBuffer(0.8, 0.2, 1000, 2, 48000, 0);
    const result = analyzeStereoField(buffer);

    // Find the band containing 1000 Hz (Mids band: 500-2000)
    const midsBand = result.bandAnalysis.find((b) => b.name === 'Mids');
    expect(midsBand).toBeDefined();
    // Balance should be negative (left-heavy)
    expect(midsBand!.balanceDb).toBeLessThan(-3);
  });
});
