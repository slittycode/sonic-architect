/**
 * Enhanced Genre Classification Service
 *
 * Expands coverage to 25+ electronic subgenres using multi-feature analysis:
 * - BPM and rhythmic features
 * - Spectral characteristics  
 * - Dynamic features (crest factor, sidechain, bass decay)
 * - Stereo field analysis
 *
 * New Features Added:
 * - Sidechain pump detection (distinguishes house from minimal techno)
 * - Bass decay analysis (distinguishes rolling techno bass from punchy house bass)
 * - Expanded subgenre coverage (ambient to hard techno)
 *
 * This extends the base genreClassifier.ts with more granular electronic subgenres
 * while maintaining backward compatibility.
 */

import { AudioFeatures, SpectralBandEnergy, DetectedNote } from '../types';
import { GenreClassification } from './genreClassifier';
import { detectSidechainPump } from './sidechainDetection';
import { analyzeBassDecay, BassDecayResult, SwingResult, detectSwing } from './bassAnalysis';
import { detectAcidPattern, AcidDetectionResult } from './acidDetection';
import { analyzeReverb, ReverbAnalysisResult } from './reverbAnalysis';
import { analyzeKickDistortion, KickAnalysisResult } from './kickAnalysis';
import { detectSupersaw, SupersawDetectionResult } from './supersawDetection';
import { detectVocals, VocalDetectionResult } from './vocalDetection';

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED GENRE SIGNATURES - 25+ Electronic Subgenres
// ═══════════════════════════════════════════════════════════════════════════════

/** Extended signature with new features for subgenre discrimination */
interface EnhancedGenreSignature {
  id: string;
  bpm: [number, number];
  /** Average sub-bass dB range */
  subBassDb: [number, number];
  /** Crest factor (peak-to-RMS) */
  crestFactor: [number, number];
  /** Onsets per second */
  onsetDensity: [number, number];
  /** Mean spectral centroid in Hz */
  spectralCentroid: [number, number];
  /** Sidechain pump strength (0-1) - key discriminator! */
  sidechainStrength: [number, number];
  /** Bass decay in seconds - key discriminator! */
  bassDecay: [number, number];
  /** RT60 reverb time in seconds — optional, for wet/dry genre discrimination */
  rt60?: [number, number];
  /** Kick distortion (THD) — optional, for hard/industrial discrimination */
  kickDistortion?: [number, number];
  /** Stereo width preference (optional) */
  msRatio?: [number, number];
}

const ENHANCED_SIGNATURES: EnhancedGenreSignature[] = [
  // ═══════════════════════════════════════════════════════════════════════════════
  // AMBIENT / DOWNTEMPO
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'ambient-drone',
    bpm: [40, 90],
    subBassDb: [-40, -20],
    crestFactor: [12, 25],
    onsetDensity: [0.5, 3],
    spectralCentroid: [1000, 4000],
    sidechainStrength: [0, 0.15],
    bassDecay: [0.8, 1.5], // long sustain
    rt60: [1.0, 3.0],
  },
  {
    id: 'ambient-techno',
    bpm: [90, 120],
    subBassDb: [-30, -15],
    crestFactor: [10, 20],
    onsetDensity: [2, 5],
    spectralCentroid: [1500, 4500],
    sidechainStrength: [0, 0.2],
    bassDecay: [0.5, 1.0],
    rt60: [0.6, 1.5],
  },
  {
    id: 'dub-techno',
    bpm: [100, 125],
    subBassDb: [-28, -12],
    crestFactor: [8, 16],
    onsetDensity: [2, 5],
    spectralCentroid: [1200, 3500],
    sidechainStrength: [0, 0.25],
    bassDecay: [0.6, 1.2], // long decay for dubby bass
    rt60: [0.8, 2.0],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // DEEP / ORGANIC HOUSE
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'deep-house',
    bpm: [118, 126],
    subBassDb: [-24, -10],
    crestFactor: [7, 13],
    onsetDensity: [3, 7],
    spectralCentroid: [1800, 4000],
    sidechainStrength: [0.35, 0.65], // moderate pump
    bassDecay: [0.2, 0.5], // punchy
  },
  {
    id: 'organic-house',
    bpm: [115, 124],
    subBassDb: [-26, -14],
    crestFactor: [9, 18],
    onsetDensity: [3, 6],
    spectralCentroid: [2000, 4500],
    sidechainStrength: [0.25, 0.5],
    bassDecay: [0.3, 0.6],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // HOUSE VARIANTS
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'classic-house',
    bpm: [120, 130],
    subBassDb: [-22, -10],
    crestFactor: [6, 12],
    onsetDensity: [4, 8],
    spectralCentroid: [2000, 4500],
    sidechainStrength: [0.4, 0.7], // strong pump
    bassDecay: [0.2, 0.45], // punchy
  },
  {
    id: 'tech-house',
    bpm: [124, 130],
    subBassDb: [-20, -8],
    crestFactor: [5, 10],
    onsetDensity: [4, 7],
    spectralCentroid: [2200, 5000],
    sidechainStrength: [0.45, 0.75], // very strong pump
    bassDecay: [0.15, 0.4], // very punchy
  },
  {
    id: 'progressive-house',
    bpm: [126, 132],
    subBassDb: [-22, -10],
    crestFactor: [6, 11],
    onsetDensity: [4, 8],
    spectralCentroid: [1800, 4500],
    sidechainStrength: [0.35, 0.6],
    bassDecay: [0.3, 0.55],
  },
  {
    id: 'afro-house',
    bpm: [118, 126],
    subBassDb: [-24, -12],
    crestFactor: [7, 14],
    onsetDensity: [5, 10],
    spectralCentroid: [2500, 5500],
    sidechainStrength: [0.3, 0.55],
    bassDecay: [0.25, 0.5],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TECHNO VARIANTS (The critical expansion!)
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'minimal-techno',
    bpm: [125, 130],
    subBassDb: [-24, -14],
    crestFactor: [7, 13],
    onsetDensity: [2, 5], // sparse
    spectralCentroid: [1500, 4000],
    sidechainStrength: [0.1, 0.35], // dry/minimal pump
    bassDecay: [0.4, 0.7], // medium sustain
    rt60: [0.2, 0.6],
  },
  {
    id: 'melodic-techno',
    bpm: [122, 128],
    subBassDb: [-22, -12],
    crestFactor: [8, 15],
    onsetDensity: [3, 6],
    spectralCentroid: [2000, 5000], // brighter from synths
    sidechainStrength: [0.25, 0.5],
    bassDecay: [0.4, 0.7],
  },
  {
    id: 'driving-techno',
    bpm: [127, 133],
    subBassDb: [-18, -8],
    crestFactor: [4, 8], // compressed
    onsetDensity: [5, 9], // dense
    spectralCentroid: [1500, 4000],
    sidechainStrength: [0.3, 0.6],
    bassDecay: [0.5, 0.85], // rolling bass
    rt60: [0.1, 0.5],
  },
  {
    id: 'industrial-techno',
    bpm: [130, 145],
    subBassDb: [-16, -4],
    crestFactor: [3, 8], // heavily compressed
    onsetDensity: [6, 12],
    spectralCentroid: [1800, 5000],
    sidechainStrength: [0.25, 0.55],
    bassDecay: [0.4, 0.8],
    kickDistortion: [0.2, 0.6], // distorted kicks
  },
  {
    id: 'hard-techno',
    bpm: [145, 160],
    subBassDb: [-14, -4],
    crestFactor: [3, 8],
    onsetDensity: [7, 14],
    spectralCentroid: [2000, 5500],
    sidechainStrength: [0.3, 0.6],
    bassDecay: [0.4, 0.75],
    rt60: [0.1, 0.4],
    kickDistortion: [0.15, 0.5], // moderately distorted kicks
  },
  {
    id: 'acid-techno',
    bpm: [125, 135],
    subBassDb: [-20, -8],
    crestFactor: [6, 12],
    onsetDensity: [5, 10],
    spectralCentroid: [2200, 6000], // higher from 303
    sidechainStrength: [0.3, 0.6],
    bassDecay: [0.3, 0.6],
  },
  {
    id: 'detroit-techno',
    bpm: [125, 135],
    subBassDb: [-22, -10],
    crestFactor: [7, 14],
    onsetDensity: [4, 8],
    spectralCentroid: [1800, 4500],
    sidechainStrength: [0.2, 0.45],
    bassDecay: [0.4, 0.75],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // TRANCE & PROGRESSIVE
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'trance',
    bpm: [136, 142],
    subBassDb: [-20, -8],
    crestFactor: [6, 12],
    onsetDensity: [4, 8],
    spectralCentroid: [2000, 5000], // bright supersaws
    sidechainStrength: [0.25, 0.55],
    bassDecay: [0.35, 0.65],
  },
  {
    id: 'psytrance',
    bpm: [140, 148],
    subBassDb: [-18, -6],
    crestFactor: [5, 11],
    onsetDensity: [7, 14],
    spectralCentroid: [2200, 5500],
    sidechainStrength: [0.35, 0.65],
    bassDecay: [0.3, 0.6],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // BASS MUSIC
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'dubstep',
    bpm: [138, 145],
    subBassDb: [-18, -4], // heavy wobble bass
    crestFactor: [7, 14],
    onsetDensity: [3, 7],
    spectralCentroid: [1200, 3500],
    sidechainStrength: [0.2, 0.5],
    bassDecay: [0.6, 1.2], // long sustain for wobbles
  },
  {
    id: 'bass-house',
    bpm: [124, 130],
    subBassDb: [-18, -6],
    crestFactor: [5, 10],
    onsetDensity: [5, 9],
    spectralCentroid: [2000, 4800],
    sidechainStrength: [0.4, 0.7],
    bassDecay: [0.25, 0.5],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // D&B & BREAKS
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'drum-bass',
    bpm: [168, 180],
    subBassDb: [-18, -6],
    crestFactor: [6, 13],
    onsetDensity: [8, 18], // very fast
    spectralCentroid: [2000, 5000],
    sidechainStrength: [0.3, 0.6],
    bassDecay: [0.3, 0.6],
  },
  {
    id: 'neurofunk',
    bpm: [170, 180],
    subBassDb: [-16, -4],
    crestFactor: [5, 11],
    onsetDensity: [9, 20],
    spectralCentroid: [2200, 5500],
    sidechainStrength: [0.25, 0.55],
    bassDecay: [0.25, 0.55],
  },
  {
    id: 'breaks',
    bpm: [125, 135],
    subBassDb: [-22, -10],
    crestFactor: [7, 14],
    onsetDensity: [5, 10],
    spectralCentroid: [2200, 5200],
    sidechainStrength: [0.25, 0.55],
    bassDecay: [0.3, 0.6],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // UK BASS / GARAGE
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'uk-garage',
    bpm: [128, 136],
    subBassDb: [-20, -8],
    crestFactor: [6, 12],
    onsetDensity: [5, 10],
    spectralCentroid: [2200, 5000],
    sidechainStrength: [0.35, 0.65],
    bassDecay: [0.25, 0.5],
  },
  {
    id: 'bassline',
    bpm: [130, 138],
    subBassDb: [-18, -6],
    crestFactor: [5, 11],
    onsetDensity: [6, 12],
    spectralCentroid: [2500, 5500],
    sidechainStrength: [0.4, 0.7],
    bassDecay: [0.2, 0.45],
  },

  // ═══════════════════════════════════════════════════════════════════════════════
  // LEGACY COMPATIBILITY - Map old genres to new signatures
  // ═══════════════════════════════════════════════════════════════════════════════
  {
    id: 'edm',
    bpm: [120, 135],
    subBassDb: [-16, -8],
    crestFactor: [5, 9],
    onsetDensity: [4, 10],
    spectralCentroid: [1500, 4000],
    sidechainStrength: [0.3, 0.6],
    bassDecay: [0.25, 0.5],
  },
  {
    id: 'hiphop',
    bpm: [70, 110],
    subBassDb: [-16, -4],
    crestFactor: [7, 11],
    onsetDensity: [2, 7],
    spectralCentroid: [800, 2500],
    sidechainStrength: [0.1, 0.4],
    bassDecay: [0.3, 0.6],
  },
  {
    id: 'rock',
    bpm: [100, 160],
    subBassDb: [-30, -15],
    crestFactor: [9, 14],
    onsetDensity: [4, 10],
    spectralCentroid: [1500, 4500],
    sidechainStrength: [0.05, 0.25],
    bassDecay: [0.2, 0.5],
  },
  {
    id: 'pop',
    bpm: [95, 130],
    subBassDb: [-20, -10],
    crestFactor: [6, 10],
    onsetDensity: [3, 8],
    spectralCentroid: [1200, 3500],
    sidechainStrength: [0.2, 0.5],
    bassDecay: [0.25, 0.5],
  },
  {
    id: 'acoustic',
    bpm: [70, 140],
    subBassDb: [-40, -22],
    crestFactor: [12, 20],
    onsetDensity: [1, 5],
    spectralCentroid: [1000, 3000],
    sidechainStrength: [0, 0.1],
    bassDecay: [0.3, 0.8],
  },
  {
    id: 'techno',
    bpm: [125, 150],
    subBassDb: [-18, -6],
    crestFactor: [4, 9],
    onsetDensity: [4, 10],
    spectralCentroid: [1200, 3500],
    sidechainStrength: [0.2, 0.5],
    bassDecay: [0.4, 0.8],
  },
  {
    id: 'house',
    bpm: [118, 132],
    subBassDb: [-20, -8],
    crestFactor: [5, 10],
    onsetDensity: [3, 8],
    spectralCentroid: [1200, 3500],
    sidechainStrength: [0.35, 0.65],
    bassDecay: [0.2, 0.45],
  },
  {
    id: 'ambient',
    bpm: [60, 110],
    subBassDb: [-32, -16],
    crestFactor: [10, 20],
    onsetDensity: [0, 3],
    spectralCentroid: [500, 2500],
    sidechainStrength: [0, 0.15],
    bassDecay: [0.6, 1.5],
  },
  {
    id: 'dnb',
    bpm: [160, 180],
    subBassDb: [-16, -5],
    crestFactor: [6, 12],
    onsetDensity: [6, 14],
    spectralCentroid: [1500, 4000],
    sidechainStrength: [0.25, 0.55],
    bassDecay: [0.3, 0.6],
  },
  {
    id: 'garage',
    bpm: [128, 142],
    subBassDb: [-16, -5],
    crestFactor: [6, 11],
    onsetDensity: [4, 9],
    spectralCentroid: [1500, 3500],
    sidechainStrength: [0.3, 0.6],
    bassDecay: [0.25, 0.5],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gaussian-like scoring function.
 * Returns 1.0 when inside range, decays outside.
 */
function rangeScore(value: number, [min, max]: [number, number], steepness = 2): number {
  if (value >= min && value <= max) return 1.0;
  const center = (min + max) / 2;
  const halfRange = (max - min) / 2;
  const distance = Math.abs(value - center);
  const normalizedDist = (distance - halfRange) / halfRange;
  return Math.max(0, 1 - Math.pow(normalizedDist, steepness));
}

function getSubBassDb(bands: SpectralBandEnergy[]): number {
  const sub = bands.find((b) => b.name === 'Sub Bass');
  return sub?.averageDb ?? -60;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENHANCED CLASSIFICATION RESULT
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnhancedGenreClassification extends GenreClassification {
  /** Secondary genre prediction (if close match) */
  secondaryGenre: string | null;
  /** All genre scores for transparency */
  allScores: { genre: string; score: number; confidence: number }[];
  /** Bass decay analysis results */
  bassAnalysis: BassDecayResult | null;
  /** Sidechain pump detection results */
  sidechainAnalysis: {
    hasSidechain: boolean;
    strength: number;
  } | null;
  /** Swing detection (if beat positions available) */
  swingAnalysis: SwingResult | null;
  /** Genre family classification */
  genreFamily: 'house' | 'techno' | 'dnb' | 'ambient' | 'trance' | 'dubstep' | 'breaks' | 'other';
  /** Acid/303 bassline detection results */
  acidDetectionResult: AcidDetectionResult | null;
  /** Acid analysis summary for telemetry */
  acidAnalysis: { isAcid: boolean; confidence: number; resonanceLevel: number } | null;
  /** Reverb/RT60 analysis results */
  reverbDetectionResult: ReverbAnalysisResult | null;
  /** Reverb analysis summary for telemetry */
  reverbAnalysis: { rt60: number; isWet: boolean; tailEnergyRatio: number } | null;
  /** Kick drum distortion analysis results */
  kickDetectionResult: KickAnalysisResult | null;
  /** Kick analysis summary for telemetry */
  kickAnalysis: { isDistorted: boolean; thd: number; harmonicRatio: number } | null;
  /** Supersaw detection results */
  supersawDetectionResult: SupersawDetectionResult | null;
  /** Supersaw analysis summary for telemetry */
  supersawAnalysis: { isSupersaw: boolean; confidence: number; voiceCount: number } | null;
  /** Vocal detection results */
  vocalDetectionResult: VocalDetectionResult | null;
  /** Vocal analysis summary for telemetry */
  vocalAnalysis: { hasVocals: boolean; confidence: number; vocalEnergyRatio: number } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CLASSIFICATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Classify genre with enhanced detection using sidechain and bass decay.
 *
 * @param features - Audio features from extractAudioFeatures()
 * @param audioBuffer - Raw audio buffer for sidechain/bass analysis
 * @param beatPositions - Optional beat positions for swing detection
 * @param notes - Optional detected notes from Basic Pitch for supersaw detection
 */
export async function classifyGenreEnhanced(
  features: AudioFeatures,
  audioBuffer: AudioBuffer,
  beatPositions?: number[],
  notes?: DetectedNote[]
): Promise<EnhancedGenreClassification> {
  // Run specialized analyses in parallel
  const [sidechainResult, bassResult, acidResult, reverbResult, kickResult, vocalResult] =
    await Promise.all([
      Promise.resolve(detectSidechainPump(audioBuffer, features.bpm)),
      Promise.resolve(analyzeBassDecay(audioBuffer, features.bpm)),
      Promise.resolve(detectAcidPattern(audioBuffer, features.bpm)),
      Promise.resolve(analyzeReverb(audioBuffer, features.bpm)),
      Promise.resolve(analyzeKickDistortion(audioBuffer, features.bpm)),
      Promise.resolve(detectVocals(audioBuffer, features.mfcc)),
    ]);

  // Supersaw detection (requires notes from Basic Pitch)
  const supersawResult = notes && notes.length > 0
    ? detectSupersaw(notes, features.spectralComplexity)
    : { isSupersaw: false, confidence: 0, voiceCount: 0, avgDetuneCents: 0, spectralComplexity: 0 };

  // Swing detection if beat positions available
  const swingResult = beatPositions && beatPositions.length >= 8
    ? detectSwing(beatPositions)
    : null;

  const subBassDb = getSubBassDb(features.spectralBands);

  // Score each genre signature
  const scores: { genre: string; score: number; rawScores: Record<string, number> }[] = [];

  for (const sig of ENHANCED_SIGNATURES) {
    const rawScores: Record<string, number> = {
      bpm: rangeScore(features.bpm, sig.bpm),
      subBassDb: rangeScore(subBassDb, sig.subBassDb, 1.5),
      crestFactor: rangeScore(features.crestFactor, sig.crestFactor, 1.5),
      onsetDensity: rangeScore(features.onsetDensity, sig.onsetDensity, 1.5),
      spectralCentroid: rangeScore(features.spectralCentroidMean, sig.spectralCentroid, 0.0003),
      sidechainStrength: rangeScore(sidechainResult.strength, sig.sidechainStrength, 2),
      bassDecay: rangeScore(bassResult.averageDecayMs / 1000, sig.bassDecay, 1.5),
    };

    // Feature weights - sidechain and bass decay get high weight for electronic genres
    const weights: Record<string, number> = {
      bpm: 1.0,
      subBassDb: 0.9,
      crestFactor: 0.7,
      onsetDensity: 0.6,
      spectralCentroid: 0.5,
      sidechainStrength: 0.95, // High weight - key discriminator
      bassDecay: 0.85, // High weight - key discriminator
    };

    // Optional RT60 scoring (lower weight since it's a new feature)
    if (sig.rt60) {
      rawScores.rt60 = rangeScore(reverbResult.rt60, sig.rt60);
      weights.rt60 = 0.5;
    }

    // Optional kick distortion scoring (for hard/industrial techno)
    if (sig.kickDistortion) {
      rawScores.kickDistortion = rangeScore(kickResult.thd, sig.kickDistortion);
      weights.kickDistortion = 0.6;
    }

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    let weightedScore = Object.keys(weights).reduce((sum, key) => {
      return sum + (rawScores[key] ?? 0) * weights[key];
    }, 0) / totalWeight;

    // Acid boost: if acid-techno signature and acid detected, boost score
    if (sig.id === 'acid-techno' && acidResult.isAcid) {
      weightedScore = Math.min(1.0, weightedScore * 1.3);
    }

    // Trance boost: if trance/progressive and supersaw detected, boost score
    if (
      (sig.id === 'trance' || sig.id === 'psytrance' || sig.id === 'progressive-house') &&
      supersawResult.isSupersaw
    ) {
      weightedScore = Math.min(1.0, weightedScore * 1.2);
    }

    scores.push({ genre: sig.id, score: weightedScore, rawScores });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const primary = scores[0];
  const secondary = scores[1].score > 0.5 ? scores[1] : null;

  // Calculate confidence based on score separation
  const scoreGap = primary.score - (secondary?.score ?? 0);
  const confidence = Math.min(1, primary.score * (1 + scoreGap));

  // Determine genre family
  const genreFamily = getGenreFamily(primary.genre);

  return {
    genre: primary.genre,
    confidence: Math.round(confidence * 100) / 100,
    scores: Object.fromEntries(scores.map((s) => [s.genre, s.score])),
    secondaryGenre: secondary?.genre ?? null,
    allScores: scores.map((s) => ({
      genre: s.genre,
      score: Math.round(s.score * 100) / 100,
      confidence: Math.round(s.score * (1 - (primary.score - s.score)) * 100) / 100,
    })),
    bassAnalysis: bassResult,
    sidechainAnalysis: {
      hasSidechain: sidechainResult.hasSidechain,
      strength: sidechainResult.strength,
    },
    swingAnalysis: swingResult,
    genreFamily,
    acidDetectionResult: acidResult,
    acidAnalysis: {
      isAcid: acidResult.isAcid,
      confidence: acidResult.confidence,
      resonanceLevel: acidResult.resonanceLevel,
    },
    reverbDetectionResult: reverbResult,
    reverbAnalysis: {
      rt60: reverbResult.rt60,
      isWet: reverbResult.isWet,
      tailEnergyRatio: reverbResult.tailEnergyRatio,
    },
    kickDetectionResult: kickResult,
    kickAnalysis: {
      isDistorted: kickResult.isDistorted,
      thd: kickResult.thd,
      harmonicRatio: kickResult.harmonicRatio,
    },
    supersawDetectionResult: supersawResult,
    supersawAnalysis: {
      isSupersaw: supersawResult.isSupersaw,
      confidence: supersawResult.confidence,
      voiceCount: supersawResult.voiceCount,
    },
    vocalDetectionResult: vocalResult,
    vocalAnalysis: {
      hasVocals: vocalResult.hasVocals,
      confidence: vocalResult.confidence,
      vocalEnergyRatio: vocalResult.vocalEnergyRatio,
    },
  };
}

/**
 * Map genre to family category.
 */
function getGenreFamily(genre: string): EnhancedGenreClassification['genreFamily'] {
  if (genre.includes('house')) return 'house';
  if (genre.includes('techno')) return 'techno';
  if (genre.includes('dnb') || genre.includes('drum') || genre.includes('neuro')) return 'dnb';
  if (genre.includes('ambient')) return 'ambient';
  if (genre.includes('trance')) return 'trance';
  if (genre.includes('dubstep')) return 'dubstep';
  if (genre.includes('break')) return 'breaks';
  return 'other';
}

/**
 * Quick genre classification without full analysis.
 * Falls back to base classifier if audioBuffer not available.
 */
export function classifyGenreQuick(features: AudioFeatures): GenreClassification {
  // Use basic scoring without sidechain/bass analysis
  const subBassDb = getSubBassDb(features.spectralBands);
  const scores: Record<string, number> = {};

  for (const sig of ENHANCED_SIGNATURES) {
    const bpmScore = rangeScore(features.bpm, sig.bpm);
    const subScore = rangeScore(subBassDb, sig.subBassDb);
    const crestScore = rangeScore(features.crestFactor, sig.crestFactor);
    const onsetScore = rangeScore(features.onsetDensity, sig.onsetDensity);
    const centroidScore = rangeScore(features.spectralCentroidMean, sig.spectralCentroid, 0.0003);

    scores[sig.id] =
      bpmScore * 0.30 +
      subScore * 0.25 +
      crestScore * 0.20 +
      onsetScore * 0.15 +
      centroidScore * 0.10;
  }

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

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

/** List of all available enhanced genres */
export const ENHANCED_GENRES = ENHANCED_SIGNATURES.map((s) => s.id);

/** Count of enhanced genre signatures */
export const ENHANCED_GENRE_COUNT = ENHANCED_SIGNATURES.length;

/** Check if a genre ID is from the enhanced set */
export function isEnhancedGenre(genreId: string): boolean {
  return ENHANCED_SIGNATURES.some((s) => s.id === genreId);
}

/** Map legacy genre IDs to recommended enhanced subgenres */
export function suggestEnhancedGenre(legacyGenre: string): string[] {
  const mapping: Record<string, string[]> = {
    'edm': ['progressive-house', 'classic-house'],
    'techno': ['driving-techno', 'melodic-techno', 'minimal-techno'],
    'house': ['classic-house', 'deep-house', 'tech-house'],
    'ambient': ['ambient-drone', 'ambient-techno', 'dub-techno'],
    'dnb': ['drum-bass', 'neurofunk'],
    'garage': ['uk-garage', 'bassline'],
  };
  return mapping[legacyGenre] || [legacyGenre];
}
