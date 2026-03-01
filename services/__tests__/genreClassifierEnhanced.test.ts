import { describe, it, expect } from 'vitest';
import {
  classifyGenreEnhanced,
  EnhancedGenreClassification,
  ENHANCED_GENRES,
  ENHANCED_GENRE_COUNT,
} from '../genreClassifierEnhanced';
import { AudioFeatures } from '../../types';

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

/** Minimum viable AudioBuffer for analysis (3 seconds at 44100Hz). */
function createAnalysisBuffer(durationSamples = 132300, sampleRate = 44100): AudioBuffer {
  // White-noise-like signal to provide energy across all bands
  const data = new Float32Array(durationSamples);
  for (let i = 0; i < durationSamples; i++) {
    // Simple pseudo-random pattern to give the DSP something to work with
    data[i] = ((i * 9301 + 49297) % 233280) / 233280 - 0.5;
    data[i] *= 0.5; // reasonable amplitude
  }
  return createMockAudioBuffer([data], sampleRate);
}

/** Creates AudioFeatures with overrideable defaults (techno-like by default). */
function makeFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    bpm: 138,
    bpmConfidence: 0.9,
    key: { root: 'A', scale: 'Minor', confidence: 0.8 },
    spectralCentroidMean: 2000,
    rmsMean: 0.2,
    rmsProfile: [],
    crestFactor: 6,
    onsetCount: 60,
    onsetDensity: 6,
    duration: 10,
    sampleRate: 44100,
    channels: 2,
    spectralBands: [
      { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -10, peakDb: -5, dominance: 'dominant' },
      { name: 'Low Bass', rangeHz: [80, 250], averageDb: -12, peakDb: -8, dominance: 'dominant' },
      { name: 'Low Mids', rangeHz: [250, 500], averageDb: -22, peakDb: -16, dominance: 'present' },
      { name: 'Mids', rangeHz: [500, 2000], averageDb: -19, peakDb: -13, dominance: 'present' },
      {
        name: 'Upper Mids',
        rangeHz: [2000, 5000],
        averageDb: -18,
        peakDb: -12,
        dominance: 'present',
      },
      { name: 'Highs', rangeHz: [5000, 10000], averageDb: -21, peakDb: -15, dominance: 'present' },
      {
        name: 'Brilliance',
        rangeHz: [10000, 20000],
        averageDb: -26,
        peakDb: -20,
        dominance: 'weak',
      },
    ],
    ...overrides,
  };
}

describe('classifyGenreEnhanced', () => {
  it('returns a valid EnhancedGenreClassification object', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());

    expect(result).toHaveProperty('genre');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('scores');
    expect(result).toHaveProperty('secondaryGenre');
    expect(result).toHaveProperty('allScores');
    expect(result).toHaveProperty('genreFamily');
    expect(result).toHaveProperty('sidechainAnalysis');
    expect(result).toHaveProperty('bassAnalysis');
  }, 10000);

  it('returns primary confidence in [0, 1] range', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  }, 10000);

  it('returns all allScores confidence values in [0, 1] (verifies clamp fix)', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());

    for (const scoreEntry of result.allScores) {
      expect(scoreEntry.confidence).toBeGreaterThanOrEqual(0);
      expect(scoreEntry.confidence).toBeLessThanOrEqual(1);
    }
  }, 10000);

  it('returns secondaryGenre as string or null', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());
    expect(result.secondaryGenre === null || typeof result.secondaryGenre === 'string').toBe(true);
  }, 10000);

  it('returns genreFamily as one of the valid enum values', async () => {
    const validFamilies = [
      'house',
      'techno',
      'dnb',
      'ambient',
      'trance',
      'dubstep',
      'breaks',
      'other',
    ];
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());
    expect(validFamilies).toContain(result.genreFamily);
  }, 10000);

  it('includes all enhanced genres in allScores', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());
    expect(result.allScores.length).toBe(ENHANCED_GENRE_COUNT);
  }, 10000);

  it('ENHANCED_GENRES exports the expected genre list', () => {
    expect(ENHANCED_GENRES).toBeInstanceOf(Array);
    expect(ENHANCED_GENRES.length).toBeGreaterThan(10);
    expect(ENHANCED_GENRES).toContain('techno');
    expect(ENHANCED_GENRES).toContain('house');
    expect(ENHANCED_GENRES).toContain('dnb');
    expect(ENHANCED_GENRES).toContain('trance');
    expect(ENHANCED_GENRES).toContain('acid-techno');
  });

  it('returns sidechainAnalysis with hasSidechain and strength', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());
    if (result.sidechainAnalysis) {
      expect(typeof result.sidechainAnalysis.hasSidechain).toBe('boolean');
      expect(result.sidechainAnalysis.strength).toBeGreaterThanOrEqual(0);
      expect(result.sidechainAnalysis.strength).toBeLessThanOrEqual(1);
    }
  }, 10000);

  it('returns bassAnalysis with expected shape when present', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer());
    if (result.bassAnalysis) {
      expect(result.bassAnalysis).toHaveProperty('averageDecayMs');
      expect(result.bassAnalysis).toHaveProperty('type');
      expect(['punchy', 'medium', 'rolling', 'sustained']).toContain(result.bassAnalysis.type);
    }
  }, 10000);

  it('classifies 174 BPM heavy-bass track into dnb family', async () => {
    const features = makeFeatures({
      bpm: 174,
      crestFactor: 8,
      onsetDensity: 10,
      spectralBands: [
        { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -7, peakDb: -3, dominance: 'dominant' },
        { name: 'Low Bass', rangeHz: [80, 250], averageDb: -11, peakDb: -7, dominance: 'dominant' },
        {
          name: 'Low Mids',
          rangeHz: [250, 500],
          averageDb: -21,
          peakDb: -15,
          dominance: 'present',
        },
        { name: 'Mids', rangeHz: [500, 2000], averageDb: -17, peakDb: -11, dominance: 'present' },
        {
          name: 'Upper Mids',
          rangeHz: [2000, 5000],
          averageDb: -15,
          peakDb: -9,
          dominance: 'present',
        },
        {
          name: 'Highs',
          rangeHz: [5000, 10000],
          averageDb: -18,
          peakDb: -12,
          dominance: 'present',
        },
        {
          name: 'Brilliance',
          rangeHz: [10000, 20000],
          averageDb: -23,
          peakDb: -17,
          dominance: 'weak',
        },
      ],
    });
    const result = await classifyGenreEnhanced(features, createAnalysisBuffer());
    expect(result.genreFamily).toBe('dnb');
  }, 10000);

  it('runs with empty beatPositions and notes without crashing', async () => {
    const result = await classifyGenreEnhanced(makeFeatures(), createAnalysisBuffer(), [], []);
    expect(result).toHaveProperty('genre');
  }, 10000);
});
