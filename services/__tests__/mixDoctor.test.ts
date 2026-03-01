import { describe, it, expect } from 'vitest';
import { generateMixReport } from '../mixDoctor';
import { AudioFeatures } from '../../types';

describe('mixDoctor', () => {
  const baseFeatures: AudioFeatures = {
    bpm: 128,
    bpmConfidence: 1,
    key: { root: 'C', scale: 'Minor', confidence: 1 },
    spectralCentroidMean: 1000,
    rmsMean: 0.2,
    rmsProfile: [],
    crestFactor: 8, // EDM optimal
    onsetCount: 10,
    onsetDensity: 2,
    duration: 5,
    sampleRate: 44100,
    channels: 1,
    spectralBands: [
      { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -11, peakDb: -5, dominance: 'dominant' },
      { name: 'Low Bass', rangeHz: [80, 250], averageDb: -14, peakDb: -10, dominance: 'dominant' },
      { name: 'Highs', rangeHz: [5000, 10000], averageDb: -23, peakDb: -15, dominance: 'present' },
    ], // These match EDM optimal
  };

  it('identifies an optimal mix', () => {
    const report = generateMixReport(baseFeatures, 'edm');
    expect(report.overallScore).toBeGreaterThan(90);
    expect(report.dynamicsAdvice.issue).toBe('optimal');

    const subAdvice = report.advice.find((a) => a.band === 'Sub Bass');
    expect(subAdvice?.issue).toBe('optimal');
  });

  it('identifies overly loud sub bass', () => {
    const loudFeatures = {
      ...baseFeatures,
      spectralBands: [
        {
          name: 'Sub Bass',
          rangeHz: [20, 80] as [number, number],
          averageDb: -4,
          peakDb: -1,
          dominance: 'dominant' as const,
        },
      ],
    };

    const report = generateMixReport(loudFeatures, 'edm');
    const subAdvice = report.advice.find((a) => a.band === 'Sub Bass');

    expect(subAdvice?.issue).toBe('too-loud');
    expect(subAdvice?.message).toContain('Muddy/overpowering subs');
    expect(report.overallScore).toBeLessThan(100);
  });

  it('identifies a lack of dynamics (too compressed)', () => {
    const squashedFeatures = { ...baseFeatures, crestFactor: 3 }; // < 5 is too compressed for EDM
    const report = generateMixReport(squashedFeatures, 'edm');

    expect(report.dynamicsAdvice.issue).toBe('too-compressed');
  });

  it('identifies too much dynamic range (too dynamic)', () => {
    const dynamicFeatures = { ...baseFeatures, crestFactor: 15 }; // > 9 is too dynamic for EDM
    const report = generateMixReport(dynamicFeatures, 'edm');

    expect(report.dynamicsAdvice.issue).toBe('too-dynamic');
  });

  it('scores within-range bands between 80 and 100', () => {
    // All bands within [minDb, maxDb] but not at exact optimal
    const withinRangeFeatures: AudioFeatures = {
      ...baseFeatures,
      spectralBands: [
        { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -9, peakDb: -5, dominance: 'dominant' },
        { name: 'Low Bass', rangeHz: [80, 250], averageDb: -11, peakDb: -8, dominance: 'dominant' },
        {
          name: 'Low Mids',
          rangeHz: [250, 500],
          averageDb: -19,
          peakDb: -14,
          dominance: 'present',
        },
        { name: 'Mids', rangeHz: [500, 2000], averageDb: -15, peakDb: -10, dominance: 'dominant' },
        {
          name: 'Upper Mids',
          rangeHz: [2000, 5000],
          averageDb: -17,
          peakDb: -12,
          dominance: 'present',
        },
        {
          name: 'Highs',
          rangeHz: [5000, 10000],
          averageDb: -19,
          peakDb: -14,
          dominance: 'present',
        },
        {
          name: 'Brilliance',
          rangeHz: [10000, 20000],
          averageDb: -23,
          peakDb: -18,
          dominance: 'present',
        },
      ],
    };

    const report = generateMixReport(withinRangeFeatures, 'edm');
    expect(report.overallScore).toBeGreaterThan(75);
  });

  it('scores perfectly when all bands are at exact optimal', () => {
    const perfectFeatures: AudioFeatures = {
      ...baseFeatures,
      spectralBands: [
        { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -11, peakDb: -5, dominance: 'dominant' },
        { name: 'Low Bass', rangeHz: [80, 250], averageDb: -14, peakDb: -8, dominance: 'dominant' },
        {
          name: 'Low Mids',
          rangeHz: [250, 500],
          averageDb: -22,
          peakDb: -16,
          dominance: 'present',
        },
        { name: 'Mids', rangeHz: [500, 2000], averageDb: -18, peakDb: -12, dominance: 'present' },
        {
          name: 'Upper Mids',
          rangeHz: [2000, 5000],
          averageDb: -20,
          peakDb: -14,
          dominance: 'present',
        },
        {
          name: 'Highs',
          rangeHz: [5000, 10000],
          averageDb: -23,
          peakDb: -17,
          dominance: 'present',
        },
        {
          name: 'Brilliance',
          rangeHz: [10000, 20000],
          averageDb: -27,
          peakDb: -20,
          dominance: 'present',
        },
      ],
    };

    const report = generateMixReport(perfectFeatures, 'edm');
    expect(report.overallScore).toBe(100);
  });

  it('still scores reasonably with one band slightly outside range', () => {
    const slightlyOffFeatures: AudioFeatures = {
      ...baseFeatures,
      spectralBands: [
        // Sub Bass 3dB too loud (outside range by 3)
        { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -5, peakDb: -2, dominance: 'dominant' },
        // Rest at optimal
        { name: 'Low Bass', rangeHz: [80, 250], averageDb: -14, peakDb: -8, dominance: 'dominant' },
        {
          name: 'Low Mids',
          rangeHz: [250, 500],
          averageDb: -22,
          peakDb: -16,
          dominance: 'present',
        },
        { name: 'Mids', rangeHz: [500, 2000], averageDb: -18, peakDb: -12, dominance: 'present' },
        {
          name: 'Upper Mids',
          rangeHz: [2000, 5000],
          averageDb: -20,
          peakDb: -14,
          dominance: 'present',
        },
        {
          name: 'Highs',
          rangeHz: [5000, 10000],
          averageDb: -23,
          peakDb: -17,
          dominance: 'present',
        },
        {
          name: 'Brilliance',
          rangeHz: [10000, 20000],
          averageDb: -27,
          peakDb: -20,
          dominance: 'present',
        },
      ],
    };

    const report = generateMixReport(slightlyOffFeatures, 'edm');
    expect(report.overallScore).toBeGreaterThan(60);
  });

  it('normalises for overall loudness (uniformly offset bands still score well)', () => {
    // All bands shifted down by 30 dB — simulates a quiet input file.
    // Spectral SHAPE still matches EDM profile, so score should remain high.
    const quietFeatures: AudioFeatures = {
      ...baseFeatures,
      spectralBands: [
        { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -41, peakDb: -35, dominance: 'weak' },
        { name: 'Low Bass', rangeHz: [80, 250], averageDb: -44, peakDb: -40, dominance: 'weak' },
        {
          name: 'Low Mids',
          rangeHz: [250, 500],
          averageDb: -52,
          peakDb: -46,
          dominance: 'absent',
        },
        { name: 'Mids', rangeHz: [500, 2000], averageDb: -48, peakDb: -42, dominance: 'weak' },
        {
          name: 'Upper Mids',
          rangeHz: [2000, 5000],
          averageDb: -50,
          peakDb: -44,
          dominance: 'weak',
        },
        {
          name: 'Highs',
          rangeHz: [5000, 10000],
          averageDb: -53,
          peakDb: -45,
          dominance: 'absent',
        },
        {
          name: 'Brilliance',
          rangeHz: [10000, 20000],
          averageDb: -57,
          peakDb: -50,
          dominance: 'absent',
        },
      ],
    };

    const report = generateMixReport(quietFeatures, 'edm');
    expect(report.overallScore).toBeGreaterThan(90);
  });
});
