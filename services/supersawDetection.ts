/**
 * Supersaw Detune Detection
 *
 * Detects supersaw synthesizer patterns characteristic of Trance, Progressive
 * House, and some Techno variants. Uses Basic Pitch's pitch bend detection to
 * identify detuned unison voices.
 *
 * A supersaw consists of multiple sawtooth waves detuned by 10-30 cents each,
 * creating a thick, rich sound. This detector looks for:
 * 1. Multiple simultaneous voices within narrow pitch range
 * 2. Characteristic detune spread (10-30 cents per voice)
 * 3. High spectral complexity in mid-high frequencies
 */

import { DetectedNote } from '../types';

export interface SupersawDetectionResult {
  /** Whether supersaw pattern was detected */
  isSupersaw: boolean;
  /** Confidence 0-1 */
  confidence: number;
  /** Number of detuned voices detected (typically 5-9 for supersaw) */
  voiceCount: number;
  /** Average detune amount in cents (typically 10-30 for supersaw) */
  avgDetuneCents: number;
  /** Spectral complexity in supersaw frequency range (200Hz-5kHz) */
  spectralComplexity: number;
}

/**
 * Detect supersaw patterns from detected notes with pitch bend data.
 *
 * @param notes - Detected notes from Basic Pitch (with pitchBend arrays)
 * @param spectralComplexity - From Essentia.js or custom analysis
 */
export function detectSupersaw(
  notes: DetectedNote[],
  spectralComplexity?: number
): SupersawDetectionResult {
  // Filter to notes with pitch bend data (from Basic Pitch)
  const notesWithBend = notes.filter((n) => n.pitchBend && n.pitchBend.length > 0);

  if (notesWithBend.length < 3) {
    return {
      isSupersaw: false,
      confidence: 0,
      voiceCount: 0,
      avgDetuneCents: 0,
      spectralComplexity: spectralComplexity ?? 0,
    };
  }

  // Analyze pitch bend patterns for detune characteristics
  const detuneValues: number[] = [];
  const voiceGroups: number[][] = [];

  for (const note of notesWithBend) {
    const bends = note.pitchBend!;

    // Calculate pitch bend variance (supersaw has multiple stable detune values)
    const bendMean = bends.reduce((a, b) => a + b, 0) / bends.length;
    const bendVariance =
      bends.reduce((acc, b) => acc + Math.pow(b - bendMean, 2), 0) / bends.length;
    const bendStdDev = Math.sqrt(bendVariance);

    // Supersaw typically has 10-30 cents detune per voice
    // Pitch bend values are in semitones, so 0.1-0.3 semitones = 10-30 cents
    if (bendStdDev > 0.05 && bendStdDev < 0.5) {
      // Find distinct detune values (voice centers)
      const voiceCenters = findVoiceCenters(bends);
      if (voiceCenters.length >= 3) {
        voiceGroups.push(voiceCenters);
        detuneValues.push(...calculateDetuneSpreads(voiceCenters));
      }
    }
  }

  // Calculate supersaw indicators
  const avgVoiceCount =
    voiceGroups.length > 0
      ? voiceGroups.reduce((a, b) => a + b.length, 0) / voiceGroups.length
      : 0;

  const avgDetuneCents =
    detuneValues.length > 0
      ? detuneValues.reduce((a, b) => a + b, 0) / detuneValues.length
      : 0;

  // Supersaw scoring
  // - Voice count: 5-9 voices is typical supersaw
  // - Detune spread: 10-30 cents per voice
  // - Multiple notes with similar detune pattern

  const voiceCountScore = Math.min(1, Math.max(0, (avgVoiceCount - 3) / 4)); // 3-7 voices = 0-1
  const detuneScore = calculateDetuneScore(avgDetuneCents);
  const consistencyScore =
    voiceGroups.length > 2
      ? Math.min(1, voiceGroups.length / 5)
      : 0;

  // Spectral complexity boost (supersaw has rich harmonic content)
  const complexityBoost =
    spectralComplexity && spectralComplexity > 5 ? 0.1 : 0;

  const confidence =
    voiceCountScore * 0.35 +
    detuneScore * 0.35 +
    consistencyScore * 0.3 +
    complexityBoost;

  const isSupersaw = confidence > 0.4 && avgVoiceCount >= 3;

  return {
    isSupersaw,
    confidence: Math.min(1, Math.round(confidence * 100) / 100),
    voiceCount: Math.round(avgVoiceCount),
    avgDetuneCents: Math.round(avgDetuneCents * 100),
    spectralComplexity: spectralComplexity ?? 0,
  };
}

/**
 * Find distinct voice centers in pitch bend data.
 * Uses histogram binning to identify stable detune values.
 */
function findVoiceCenters(pitchBends: number[]): number[] {
  if (pitchBends.length < 10) return [];

  // Create histogram of pitch bend values
  const binWidth = 0.05; // 5 cents bins
  const bins = new Map<number, number>();

  for (const bend of pitchBends) {
    const binKey = Math.round(bend / binWidth) * binWidth;
    bins.set(binKey, (bins.get(binKey) ?? 0) + 1);
  }

  // Find peaks (bins with significantly more hits than neighbors)
  const sortedBins = Array.from(bins.entries()).sort((a, b) => a[0] - b[0]);
  const voiceCenters: number[] = [];

  for (let i = 1; i < sortedBins.length - 1; i++) {
    const [bin, count] = sortedBins[i];
    const [, prevCount] = sortedBins[i - 1];
    const [, nextCount] = sortedBins[i + 1];

    // Peak detection: higher than neighbors and significant count
    if (count > prevCount * 1.5 && count > nextCount * 1.5 && count > 5) {
      voiceCenters.push(bin);
    }
  }

  return voiceCenters;
}

/**
 * Calculate detune spreads between voice centers.
 */
function calculateDetuneSpreads(voiceCenters: number[]): number[] {
  const spreads: number[] = [];

  for (let i = 1; i < voiceCenters.length; i++) {
    const spread = Math.abs(voiceCenters[i] - voiceCenters[i - 1]) * 100; // Convert to cents
    if (spread > 5 && spread < 50) {
      // Reasonable detune range
      spreads.push(spread);
    }
  }

  return spreads;
}

/**
 * Score detune amount (10-30 cents is ideal for supersaw).
 */
function calculateDetuneScore(detuneCents: number): number {
  if (detuneCents < 5 || detuneCents > 50) return 0;

  // Peak at 20 cents, falling off on either side
  const optimalDetune = 20;
  const distance = Math.abs(detuneCents - optimalDetune);

  if (distance <= 10) {
    return 1 - distance * 0.05; // 1.0 at 20 cents, 0.5 at 10 or 30 cents
  } else {
    return Math.max(0, 0.5 - (distance - 10) * 0.05);
  }
}

/**
 * Quick check for supersaw presence (for UI indicators).
 */
export function hasSupersaw(
  notes: DetectedNote[],
  spectralComplexity?: number,
  threshold: number = 0.4
): boolean {
  const result = detectSupersaw(notes, spectralComplexity);
  return result.isSupersaw && result.confidence >= threshold;
}
