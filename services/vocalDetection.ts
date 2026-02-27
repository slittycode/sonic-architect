/**
 * Vocal Detection
 *
 * Detects vocal presence in audio tracks using spectral and timbral features.
 * Useful for distinguishing Vocal House from Instrumental Techno, and identifying
 * tracks with vocal elements for arrangement analysis.
 *
 * Vocal indicators:
 * - Formant structure in 300Hz-3kHz range (vocal fundamental + formants)
 * - Harmonic complexity (voice produces rich harmonic series)
 * - MFCC patterns characteristic of human voice
 * - Energy concentration in vocal frequency range (150Hz-1.5kHz fundamental,
 *   formants up to 4kHz)
 */

import { fftInPlace } from './audioAnalysis';

export interface VocalDetectionResult {
  /** Whether vocals were detected */
  hasVocals: boolean;
  /** Confidence 0-1 */
  confidence: number;
  /** Vocal energy ratio (energy in vocal freq range / total energy) */
  vocalEnergyRatio: number;
  /** Formant strength indicator 0-1 */
  formantStrength: number;
  /** MFCC-based vocal likelihood 0-1 */
  mfccLikelihood: number;
}

const VOCAL_FUNDAMENTAL_LOW = 150; // Hz (low male voice)
const VOCAL_FUNDAMENTAL_HIGH = 1500; // Hz (high female voice)
const FORMANT_LOW = 300; // Hz (first formant)
const FORMANT_HIGH = 4000; // Hz (third formant)
const FRAME_SIZE = 2048;
const HOP_SIZE = 512;

/**
 * Detect vocal presence using spectral analysis.
 */
export function detectVocals(
  audioBuffer: AudioBuffer,
  mfcc?: number[]
): VocalDetectionResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Step 1: Calculate energy in vocal frequency ranges
  const vocalFundamentalLowBin = Math.floor(
    (VOCAL_FUNDAMENTAL_LOW * FRAME_SIZE) / sampleRate
  );
  const vocalFundamentalHighBin = Math.min(
    Math.ceil((VOCAL_FUNDAMENTAL_HIGH * FRAME_SIZE) / sampleRate),
    FRAME_SIZE / 2 - 1
  );
  const formantLowBin = Math.floor((FORMANT_LOW * FRAME_SIZE) / sampleRate);
  const formantHighBin = Math.min(
    Math.ceil((FORMANT_HIGH * FRAME_SIZE) / sampleRate),
    FRAME_SIZE / 2 - 1
  );

  let vocalEnergy = 0;
  let formantEnergy = 0;
  let totalEnergy = 0;

  const real = new Float32Array(FRAME_SIZE);
  const imag = new Float32Array(FRAME_SIZE);

  for (
    let offset = 0;
    offset + FRAME_SIZE <= channelData.length;
    offset += HOP_SIZE
  ) {
    // Apply window and FFT
    for (let i = 0; i < FRAME_SIZE; i++) {
      real[i] = (channelData[offset + i] ?? 0) * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)));
      imag[i] = 0;
    }
    fftInPlace(real, imag);

    // Calculate energy in different bands
    for (let k = 0; k < FRAME_SIZE / 2; k++) {
      const magnitude = Math.hypot(real[k], imag[k]);
      const energy = magnitude * magnitude;
      totalEnergy += energy;

      if (k >= vocalFundamentalLowBin && k <= vocalFundamentalHighBin) {
        vocalEnergy += energy;
      }

      if (k >= formantLowBin && k <= formantHighBin) {
        formantEnergy += energy;
      }
    }
  }

  // Normalize energies
  const vocalEnergyRatio = totalEnergy > 0 ? vocalEnergy / totalEnergy : 0;

  // Step 2: Formant strength detection
  // Vocals have characteristic formant peaks at ~500Hz, ~1.5kHz, ~2.5kHz
  const formantStrength = detectFormantStrength(
    channelData,
    sampleRate
  );

  // Step 3: MFCC-based vocal likelihood (if MFCC provided)
  const mfccLikelihood = mfcc ? calculateMfccVocalLikelihood(mfcc) : 0.5;

  // Vocal scoring
  // - Vocal energy ratio: 0.2-0.5 is typical for vocals in mix
  // - Formant strength: >0.3 suggests vocal formants
  // - MFCC likelihood: >0.5 suggests vocal timbre

  const energyScore = Math.min(1, Math.max(0, (vocalEnergyRatio - 0.1) / 0.3));
  const formantScore = formantStrength;
  const mfccScore = mfccLikelihood;

  const confidence =
    energyScore * 0.35 +
    formantScore * 0.35 +
    mfccScore * 0.3;

  const hasVocals = confidence > 0.45;

  return {
    hasVocals,
    confidence: Math.round(confidence * 100) / 100,
    vocalEnergyRatio: Math.round(vocalEnergyRatio * 100) / 100,
    formantStrength: Math.round(formantStrength * 100) / 100,
    mfccLikelihood: Math.round(mfccLikelihood * 100) / 100,
  };
}

/**
 * Detect formant structure characteristic of human voice.
 * Uses peak detection in spectrum to find formant frequencies.
 */
function detectFormantStrength(
  channelData: Float32Array,
  sampleRate: number
): number {
  // Expected formant frequencies for average adult voice
  const expectedFormants = [500, 1500, 2500]; // Hz
  const formantTolerance = 200; // Hz tolerance

  const real = new Float32Array(FRAME_SIZE);
  const imag = new Float32Array(FRAME_SIZE);

  let formantMatches = 0;
  let totalFrames = 0;

  // Analyze multiple frames
  for (
    let offset = 0;
    offset + FRAME_SIZE <= channelData.length;
    offset += HOP_SIZE * 4
  ) {
    totalFrames++;

    // FFT
    for (let i = 0; i < FRAME_SIZE; i++) {
      real[i] = channelData[offset + i] ?? 0;
      imag[i] = 0;
    }
    fftInPlace(real, imag);

    // Find spectral peaks
    const peaks: number[] = [];
    for (let k = 1; k < FRAME_SIZE / 2 - 1; k++) {
      const prevMag = Math.hypot(real[k - 1], imag[k - 1]);
      const currMag = Math.hypot(real[k], imag[k]);
      const nextMag = Math.hypot(real[k + 1], imag[k + 1]);

      if (currMag > prevMag && currMag > nextMag && currMag > 0.01) {
        const freq = (k * sampleRate) / FRAME_SIZE;
        peaks.push(freq);
      }
    }

    // Check if peaks match expected formant frequencies
    let frameFormantMatches = 0;
    for (const expected of expectedFormants) {
      const hasMatch = peaks.some(
        (peak) => Math.abs(peak - expected) < formantTolerance
      );
      if (hasMatch) frameFormantMatches++;
    }

    formantMatches += frameFormantMatches;
  }

  // Return ratio of matched formants (0-3 formants / 3 expected)
  return totalFrames > 0
    ? Math.min(1, (formantMatches / totalFrames) / 3)
    : 0;
}

/**
 * Calculate vocal likelihood from MFCC coefficients.
 * Human voice has characteristic MFCC patterns.
 */
function calculateMfccVocalLikelihood(mfcc: number[]): number {
  if (mfcc.length < 13) return 0.5;

  // Vocal characteristics in MFCC space:
  // - MFCC 1-3: Strong energy (vocal fundamental + first formant)
  // - MFCC 4-8: Moderate energy (higher formants)
  // - MFCC 9-13: Lower energy (fine detail)

  const lowEnergy = Math.abs(mfcc[1]) + Math.abs(mfcc[2]) + Math.abs(mfcc[3]);
  const midEnergy =
    Math.abs(mfcc[4]) +
    Math.abs(mfcc[5]) +
    Math.abs(mfcc[6]) +
    Math.abs(mfcc[7]) +
    Math.abs(mfcc[8]);
  const highEnergy =
    Math.abs(mfcc[9]) +
    Math.abs(mfcc[10]) +
    Math.abs(mfcc[11]) +
    Math.abs(mfcc[12]);

  // Vocal pattern: strong low, moderate mid, lower high
  const totalEnergy = lowEnergy + midEnergy + highEnergy;
  if (totalEnergy === 0) return 0.5;

  const lowRatio = lowEnergy / totalEnergy;
  const midRatio = midEnergy / totalEnergy;
  const highRatio = highEnergy / totalEnergy;

  // Ideal vocal pattern: ~40% low, ~35% mid, ~25% high
  const idealLow = 0.4;
  const idealMid = 0.35;
  const idealHigh = 0.25;

  const lowMatch = 1 - Math.abs(lowRatio - idealLow);
  const midMatch = 1 - Math.abs(midRatio - idealMid);
  const highMatch = 1 - Math.abs(highRatio - idealHigh);

  return (lowMatch + midMatch + highMatch) / 3;
}

/**
 * Quick check for vocal presence (for UI indicators).
 */
export function hasVocals(
  audioBuffer: AudioBuffer,
  mfcc?: number[],
  threshold: number = 0.45
): boolean {
  const result = detectVocals(audioBuffer, mfcc);
  return result.hasVocals && result.confidence >= threshold;
}
