import { describe, it, expect } from 'vitest';
import { calculateSynthParams, generateVitalPatch, generateOperatorPatch } from '../patchSmith';
import { AudioFeatures } from '../../types';

describe('patchSmith', () => {
  const mockFeatures: AudioFeatures = {
    bpm: 120,
    bpmConfidence: 1,
    key: { root: 'C', scale: 'Major', confidence: 1 },
    spectralCentroidMean: 2000,
    rmsMean: 0.1,
    rmsProfile: [],
    spectralBands: [
      { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -10, peakDb: -5, dominance: 'dominant' },
      { name: 'Highs', rangeHz: [5000, 10000], averageDb: -60, peakDb: -50, dominance: 'absent' }
    ],
    crestFactor: 15, // High crest factor -> short attack
    onsetCount: 10,
    onsetDensity: 2,
    duration: 5,
    sampleRate: 44100,
    channels: 1
  };

  it('calculates parameters correctly based on audio features', () => {
    const params = calculateSynthParams(mockFeatures);
    
    // High crest factor -> fast attack
    expect(params.attack).toBeLessThan(0.01);
    
    // Low Highs, High Sub Bass -> sine wave
    expect(params.waveform).toBe('sine');
    expect(params.operatorWave).toBe(0);
    
    // Spectral centroid of 2000 -> cutoff is 2000Hz
    expect(params.cutoffHz).toBe(2000);
  });

  it('generates a valid JSON Vital patch', () => {
    const patchString = generateVitalPatch(mockFeatures);
    
    // Should parse without throwing
    const parsed = JSON.parse(patchString);
    expect(parsed.plugin_version).toBe('1.5.5');
    expect(parsed.settings.filter_1_cutoff).toBeDefined();
    expect(parsed.settings.osc_1_waveform).toBe('sine');
  });

  it('generates a valid XML Operator patch', () => {
    const xmlString = generateOperatorPatch(mockFeatures);
    
    expect(xmlString).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xmlString).toContain('<Ableton');
    expect(xmlString).toContain('<Operator>');
    expect(xmlString).toContain('<Waveform Value="0" />');
    expect(xmlString).toContain('</Ableton>');
  });
});
