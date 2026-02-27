import { describe, it, expect } from 'vitest';
import { classifyGenre, GenreClassification } from '../genreClassifier';
import { AudioFeatures } from '../../types';

/** Helper to create AudioFeatures with specific values for classification. */
function makeFeatures(overrides: Partial<AudioFeatures>): AudioFeatures {
  return {
    bpm: 128,
    bpmConfidence: 1,
    key: { root: 'C', scale: 'Minor', confidence: 1 },
    spectralCentroidMean: 2000,
    rmsMean: 0.2,
    rmsProfile: [],
    crestFactor: 7,
    onsetCount: 50,
    onsetDensity: 5,
    duration: 10,
    sampleRate: 44100,
    channels: 2,
    spectralBands: [
      { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -12, peakDb: -6, dominance: 'dominant' },
      { name: 'Low Bass', rangeHz: [80, 250], averageDb: -14, peakDb: -10, dominance: 'dominant' },
      { name: 'Low Mids', rangeHz: [250, 500], averageDb: -22, peakDb: -16, dominance: 'present' },
      { name: 'Mids', rangeHz: [500, 2000], averageDb: -18, peakDb: -12, dominance: 'present' },
      { name: 'Upper Mids', rangeHz: [2000, 5000], averageDb: -20, peakDb: -14, dominance: 'present' },
      { name: 'Highs', rangeHz: [5000, 10000], averageDb: -23, peakDb: -17, dominance: 'present' },
      { name: 'Brilliance', rangeHz: [10000, 20000], averageDb: -27, peakDb: -21, dominance: 'weak' },
    ],
    ...overrides,
  };
}

describe('genreClassifier', () => {
  it('returns a valid GenreClassification object', () => {
    const result = classifyGenre(makeFeatures({}));
    expect(result).toHaveProperty('genre');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('scores');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('classifies a 170 BPM heavy sub-bass track as DnB', () => {
    const result = classifyGenre(
      makeFeatures({
        bpm: 174,
        crestFactor: 8,
        onsetDensity: 10,
        spectralCentroidMean: 2500,
        spectralBands: [
          { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -8, peakDb: -4, dominance: 'dominant' },
          { name: 'Low Bass', rangeHz: [80, 250], averageDb: -12, peakDb: -8, dominance: 'dominant' },
          { name: 'Low Mids', rangeHz: [250, 500], averageDb: -21, peakDb: -15, dominance: 'present' },
          { name: 'Mids', rangeHz: [500, 2000], averageDb: -18, peakDb: -12, dominance: 'present' },
          { name: 'Upper Mids', rangeHz: [2000, 5000], averageDb: -16, peakDb: -10, dominance: 'present' },
          { name: 'Highs', rangeHz: [5000, 10000], averageDb: -19, peakDb: -13, dominance: 'present' },
          { name: 'Brilliance', rangeHz: [10000, 20000], averageDb: -23, peakDb: -17, dominance: 'weak' },
        ],
      })
    );
    expect(result.genre).toBe('dnb');
  });

  it('classifies a slow low-sub compressed track as hip-hop', () => {
    const result = classifyGenre(
      makeFeatures({
        bpm: 85,
        crestFactor: 9,
        onsetDensity: 4,
        spectralCentroidMean: 1500,
        spectralBands: [
          { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -8, peakDb: -3, dominance: 'dominant' },
          { name: 'Low Bass', rangeHz: [80, 250], averageDb: -13, peakDb: -8, dominance: 'dominant' },
          { name: 'Low Mids', rangeHz: [250, 500], averageDb: -23, peakDb: -17, dominance: 'present' },
          { name: 'Mids', rangeHz: [500, 2000], averageDb: -14, peakDb: -9, dominance: 'dominant' },
          { name: 'Upper Mids', rangeHz: [2000, 5000], averageDb: -19, peakDb: -13, dominance: 'present' },
          { name: 'Highs', rangeHz: [5000, 10000], averageDb: -22, peakDb: -16, dominance: 'present' },
          { name: 'Brilliance', rangeHz: [10000, 20000], averageDb: -26, peakDb: -20, dominance: 'weak' },
        ],
      })
    );
    expect(result.genre).toBe('hiphop');
  });

  it('classifies a sparse, slow, highly dynamic track as ambient', () => {
    // Ambient distinguishes from acoustic via: deeper sub-bass (drone pads),
    // extremely low onset density, and a darker spectral centroid.
    const result = classifyGenre(
      makeFeatures({
        bpm: 75,
        crestFactor: 14,
        onsetDensity: 0.5,
        spectralCentroidMean: 800,
        spectralBands: [
          { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -20, peakDb: -14, dominance: 'present' },
          { name: 'Low Bass', rangeHz: [80, 250], averageDb: -17, peakDb: -11, dominance: 'present' },
          { name: 'Low Mids', rangeHz: [250, 500], averageDb: -18, peakDb: -12, dominance: 'present' },
          { name: 'Mids', rangeHz: [500, 2000], averageDb: -16, peakDb: -10, dominance: 'present' },
          { name: 'Upper Mids', rangeHz: [2000, 5000], averageDb: -16, peakDb: -10, dominance: 'present' },
          { name: 'Highs', rangeHz: [5000, 10000], averageDb: -15, peakDb: -9, dominance: 'present' },
          { name: 'Brilliance', rangeHz: [10000, 20000], averageDb: -17, peakDb: -11, dominance: 'present' },
        ],
      })
    );
    expect(result.genre).toBe('ambient');
  });

  it('classifies a dynamic mid-tempo track with weak sub as rock', () => {
    const result = classifyGenre(
      makeFeatures({
        bpm: 130,
        crestFactor: 12,
        onsetDensity: 7,
        spectralCentroidMean: 3000,
        spectralBands: [
          { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -22, peakDb: -16, dominance: 'present' },
          { name: 'Low Bass', rangeHz: [80, 250], averageDb: -13, peakDb: -8, dominance: 'dominant' },
          { name: 'Low Mids', rangeHz: [250, 500], averageDb: -15, peakDb: -10, dominance: 'dominant' },
          { name: 'Mids', rangeHz: [500, 2000], averageDb: -12, peakDb: -7, dominance: 'dominant' },
          { name: 'Upper Mids', rangeHz: [2000, 5000], averageDb: -14, peakDb: -9, dominance: 'dominant' },
          { name: 'Highs', rangeHz: [5000, 10000], averageDb: -18, peakDb: -12, dominance: 'present' },
          { name: 'Brilliance', rangeHz: [10000, 20000], averageDb: -24, peakDb: -18, dominance: 'present' },
        ],
      })
    );
    expect(result.genre).toBe('rock');
  });

  it('classifies a fast compressed sub-heavy track as techno', () => {
    const result = classifyGenre(
      makeFeatures({
        bpm: 138,
        crestFactor: 6,
        onsetDensity: 8,
        spectralCentroidMean: 2000,
        spectralBands: [
          { name: 'Sub Bass', rangeHz: [20, 80], averageDb: -9, peakDb: -4, dominance: 'dominant' },
          { name: 'Low Bass', rangeHz: [80, 250], averageDb: -11, peakDb: -6, dominance: 'dominant' },
          { name: 'Low Mids', rangeHz: [250, 500], averageDb: -23, peakDb: -17, dominance: 'present' },
          { name: 'Mids', rangeHz: [500, 2000], averageDb: -20, peakDb: -14, dominance: 'present' },
          { name: 'Upper Mids', rangeHz: [2000, 5000], averageDb: -17, peakDb: -11, dominance: 'present' },
          { name: 'Highs', rangeHz: [5000, 10000], averageDb: -20, peakDb: -14, dominance: 'present' },
          { name: 'Brilliance', rangeHz: [10000, 20000], averageDb: -25, peakDb: -19, dominance: 'weak' },
        ],
      })
    );
    expect(result.genre).toBe('techno');
  });

  it('scores all 10 genres', () => {
    const result = classifyGenre(makeFeatures({}));
    const genreIds = Object.keys(result.scores);
    expect(genreIds).toContain('edm');
    expect(genreIds).toContain('hiphop');
    expect(genreIds).toContain('rock');
    expect(genreIds).toContain('pop');
    expect(genreIds).toContain('acoustic');
    expect(genreIds).toContain('techno');
    expect(genreIds).toContain('house');
    expect(genreIds).toContain('ambient');
    expect(genreIds).toContain('dnb');
    expect(genreIds).toContain('garage');
  });
});
