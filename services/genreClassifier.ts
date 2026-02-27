/**
 * Local Genre Classification
 *
 * Rule-based classifier that determines genre from AudioFeatures without
 * requiring any API call. Uses a weighted scoring system across BPM range,
 * sub-bass dominance, crest factor, onset density, and spectral centroid
 * to match against the 10 genres defined in genreProfiles.ts.
 */

import { AudioFeatures, SpectralBandEnergy } from '../types';

export interface GenreClassification {
  genre: string;
  confidence: number;
  scores: Record<string, number>;
}

/** Feature ranges that characterise each genre profile. */
interface GenreSignature {
  id: string;
  bpm: [number, number];
  /** Average sub-bass dB range — higher (closer to 0) = more sub weight. */
  subBassDb: [number, number];
  crestFactor: [number, number];
  onsetDensity: [number, number];
  spectralCentroid: [number, number];
}

const SIGNATURES: GenreSignature[] = [
  {
    id: 'edm',
    bpm: [120, 135],
    subBassDb: [-16, -8],
    crestFactor: [5, 9],
    onsetDensity: [4, 10],
    spectralCentroid: [1500, 4000],
  },
  {
    id: 'hiphop',
    bpm: [70, 110],
    subBassDb: [-16, -4],
    crestFactor: [7, 11],
    onsetDensity: [2, 7],
    spectralCentroid: [800, 2500],
  },
  {
    id: 'rock',
    bpm: [100, 160],
    subBassDb: [-30, -15],
    crestFactor: [9, 14],
    onsetDensity: [4, 10],
    spectralCentroid: [1500, 4500],
  },
  {
    id: 'pop',
    bpm: [95, 130],
    subBassDb: [-20, -10],
    crestFactor: [6, 10],
    onsetDensity: [3, 8],
    spectralCentroid: [1200, 3500],
  },
  {
    id: 'acoustic',
    bpm: [70, 140],
    subBassDb: [-40, -22],
    crestFactor: [12, 20],
    onsetDensity: [1, 5],
    spectralCentroid: [1000, 3000],
  },
  {
    id: 'techno',
    bpm: [125, 150],
    subBassDb: [-14, -5],
    crestFactor: [4, 8],
    onsetDensity: [5, 12],
    spectralCentroid: [1000, 3000],
  },
  {
    id: 'house',
    bpm: [118, 132],
    subBassDb: [-18, -8],
    crestFactor: [5, 10],
    onsetDensity: [3, 8],
    spectralCentroid: [1200, 3500],
  },
  {
    id: 'ambient',
    bpm: [60, 110],
    subBassDb: [-32, -16],
    crestFactor: [10, 20],
    onsetDensity: [0, 3],
    spectralCentroid: [500, 2500],
  },
  {
    id: 'dnb',
    bpm: [160, 180],
    subBassDb: [-16, -5],
    crestFactor: [6, 12],
    onsetDensity: [6, 14],
    spectralCentroid: [1500, 4000],
  },
  {
    id: 'garage',
    bpm: [128, 142],
    subBassDb: [-16, -5],
    crestFactor: [6, 11],
    onsetDensity: [4, 9],
    spectralCentroid: [1000, 3000],
  },
];

/**
 * Score how well a value fits within a [min, max] range.
 * Returns 1.0 when inside the range, decays linearly outside with
 * the given falloff rate per unit of distance.
 */
function rangeScore(value: number, [min, max]: [number, number], falloff: number = 0.1): number {
  if (value >= min && value <= max) return 1.0;
  const distance = value < min ? min - value : value - max;
  return Math.max(0, 1.0 - distance * falloff);
}

function getSubBassDb(bands: SpectralBandEnergy[]): number {
  const sub = bands.find((b) => b.name === 'Sub Bass');
  return sub?.averageDb ?? -60;
}

/**
 * Classify the genre of an audio track from its extracted features.
 * Returns the best-matching genre ID and a confidence score (0-1).
 */
export function classifyGenre(features: AudioFeatures): GenreClassification {
  const subBassDb = getSubBassDb(features.spectralBands);
  const scores: Record<string, number> = {};

  for (const sig of SIGNATURES) {
    // Weight each dimension according to its discriminative power.
    // BPM is the strongest single discriminator (DnB at 170 vs hip-hop at 85).
    const bpmScore = rangeScore(features.bpm, sig.bpm, 0.04);
    const subScore = rangeScore(subBassDb, sig.subBassDb, 0.06);
    const crestScore = rangeScore(features.crestFactor, sig.crestFactor, 0.08);
    const onsetScore = rangeScore(features.onsetDensity, sig.onsetDensity, 0.1);
    const centroidScore = rangeScore(features.spectralCentroidMean, sig.spectralCentroid, 0.0005);

    scores[sig.id] =
      bpmScore * 0.30 + subScore * 0.25 + crestScore * 0.20 + onsetScore * 0.15 + centroidScore * 0.10;
  }

  // Find best match
  let bestId = 'edm';
  let bestScore = 0;
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return {
    genre: bestId,
    confidence: Math.round(bestScore * 100) / 100,
    scores,
  };
}
