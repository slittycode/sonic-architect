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
      { name: 'Highs', rangeHz: [5000, 10000], averageDb: -23, peakDb: -15, dominance: 'present' }
    ] // These match EDM optimal
  };

  it('identifies an optimal mix', () => {
    const report = generateMixReport(baseFeatures, 'edm');
    expect(report.overallScore).toBeGreaterThan(90);
    expect(report.dynamicsAdvice.issue).toBe('optimal');
    
    const subAdvice = report.advice.find(a => a.band === 'Sub Bass');
    expect(subAdvice?.issue).toBe('optimal');
  });

  it('identifies overly loud sub bass', () => {
    const loudFeatures = {
      ...baseFeatures,
      spectralBands: [
        { name: 'Sub Bass', rangeHz: [20, 80] as [number, number], averageDb: -4, peakDb: -1, dominance: 'dominant' as const }
      ]
    };
    
    const report = generateMixReport(loudFeatures, 'edm');
    const subAdvice = report.advice.find(a => a.band === 'Sub Bass');
    
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
});
