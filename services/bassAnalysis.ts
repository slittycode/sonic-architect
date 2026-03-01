/**
 * Bass Decay Analysis
 *
 * Distinguishes between punchy bass (short decay, house/tech-house) and
 * rolling bass (long decay, techno/trance). This is a key discriminator
 * for electronic subgenres at similar BPMs.
 *
 * Algorithm:
 * 1. Detect bass transients (onsets in 20-150Hz range)
 * 2. Measure envelope decay time for each transient
 * 3. Classify as punchy (<300ms), medium (300-600ms), or rolling (>600ms)
 */

export interface BassDecayResult {
  /** Average decay time in milliseconds */
  averageDecayMs: number;
  /** Decay classification */
  type: 'punchy' | 'medium' | 'rolling' | 'sustained';
  /** Percentage of bass energy that is transient vs sustained (0-1) */
  transientRatio: number;
  /** Average frequency of bass fundamental in Hz */
  fundamentalHz: number;
  /** Number of bass transients detected */
  transientCount: number;
}

const DECAY_THRESHOLD_DB = -6; // Measure decay to -6dB from peak
const MAX_DECAY_MS = 2000; // Cap at 2 seconds

/**
 * Analyze bass decay characteristics.
 */
export function analyzeBassDecay(audioBuffer: AudioBuffer, bpm: number): BassDecayResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Extract bass band using simple lowpass
  const bassSignal = extractBassBandSimple(channelData, sampleRate);

  // Find bass transients (onsets)
  const onsets = findBassOnsets(bassSignal, sampleRate, bpm);

  if (onsets.length < 3) {
    // Not enough transients - likely sustained bass (pad/drone)
    return {
      averageDecayMs: 1000,
      type: 'sustained',
      transientRatio: 0.2,
      fundamentalHz: estimateFundamentalZCR(bassSignal, sampleRate),
      transientCount: onsets.length,
    };
  }

  // Measure decay time for each onset
  const decayTimes: number[] = [];

  for (let i = 0; i < onsets.length - 1; i++) {
    const onsetSample = onsets[i];
    const nextOnset = onsets[i + 1];
    const maxDecaySamples = Math.min(
      nextOnset - onsetSample,
      Math.floor((MAX_DECAY_MS / 1000) * sampleRate)
    );

    const decayMs = measureDecayTime(bassSignal, onsetSample, maxDecaySamples, sampleRate);

    if (decayMs > 0) {
      decayTimes.push(decayMs);
    }
  }

  if (decayTimes.length === 0) {
    return {
      averageDecayMs: 800,
      type: 'sustained',
      transientRatio: 0.3,
      fundamentalHz: estimateFundamentalZCR(bassSignal, sampleRate),
      transientCount: onsets.length,
    };
  }

  // Calculate average decay
  const avgDecayMs = decayTimes.reduce((a, b) => a + b, 0) / decayTimes.length;

  // Determine type based on decay time
  let type: BassDecayResult['type'];
  if (avgDecayMs < 300) type = 'punchy';
  else if (avgDecayMs < 600) type = 'medium';
  else if (avgDecayMs < 1000) type = 'rolling';
  else type = 'sustained';

  // Calculate transient ratio
  const transientRatio = calculateTransientRatio(bassSignal, onsets, sampleRate);

  return {
    averageDecayMs: Math.round(avgDecayMs),
    type,
    transientRatio: Math.round(transientRatio * 100) / 100,
    fundamentalHz: Math.round(estimateFundamentalZCR(bassSignal, sampleRate)),
    transientCount: onsets.length,
  };
}

/**
 * Extract bass band using one-pole lowpass at 150Hz.
 */
function extractBassBandSimple(signal: Float32Array, sampleRate: number): Float32Array {
  const result = new Float32Array(signal.length);

  // One-pole lowpass at 150Hz
  const fc = 150 / sampleRate;
  const x = Math.exp(-2 * Math.PI * fc);
  const a0 = 1 - x;
  let y1 = 0;

  for (let i = 0; i < signal.length; i++) {
    y1 = a0 * signal[i] + x * y1;
    result[i] = y1;
  }

  return result;
}

/**
 * Find bass transients using energy-based onset detection.
 */
function findBassOnsets(bassSignal: Float32Array, sampleRate: number, bpm: number): number[] {
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hops
  const frameSize = Math.floor(sampleRate * 0.04); // 40ms frames
  const onsets: number[] = [];

  // Calculate minimum distance between onsets based on BPM
  const beatDurationMs = (60 / bpm) * 1000;
  const minOnsetDistance = Math.floor(((beatDurationMs * 0.25) / 1000) * sampleRate); // ~1/16th note

  let prevEnergy = 0;
  const threshold = 0.005;
  let lastOnset = -minOnsetDistance;

  for (let i = 0; i + frameSize < bassSignal.length; i += hopSize) {
    // Compute frame energy
    let energy = 0;
    for (let j = i; j < i + frameSize; j++) {
      energy += bassSignal[j] * bassSignal[j];
    }
    energy = Math.sqrt(energy / frameSize);

    // Detect onset (sudden energy increase)
    const diff = energy - prevEnergy;
    const relativeDiff = prevEnergy > 0.001 ? diff / prevEnergy : 0;

    if (relativeDiff > 0.5 && energy > 0.01 && i - lastOnset >= minOnsetDistance) {
      onsets.push(i);
      lastOnset = i;
    }

    prevEnergy = energy * 0.8 + prevEnergy * 0.2; // Smooth
  }

  return onsets;
}

/**
 * Measure decay time from onset to -6dB point.
 */
function measureDecayTime(
  signal: Float32Array,
  onsetSample: number,
  maxSamples: number,
  sampleRate: number
): number {
  // Find actual peak near onset
  let peakValue = 0;
  const searchWindow = Math.floor(sampleRate * 0.05); // 50ms
  for (let i = onsetSample; i < onsetSample + searchWindow && i < signal.length; i++) {
    peakValue = Math.max(peakValue, Math.abs(signal[i]));
  }

  if (peakValue < 0.001) return 0;

  const thresholdValue = peakValue * Math.pow(10, DECAY_THRESHOLD_DB / 20);

  for (let i = 0; i < maxSamples && onsetSample + i < signal.length; i++) {
    const value = Math.abs(signal[onsetSample + i]);
    if (value < thresholdValue) {
      return (i / sampleRate) * 1000; // Convert to ms
    }
  }

  return (maxSamples / sampleRate) * 1000;
}

/**
 * Calculate ratio of transient energy to total bass energy.
 */
function calculateTransientRatio(
  bassSignal: Float32Array,
  onsets: number[],
  sampleRate: number
): number {
  if (onsets.length === 0) return 0;

  const transientWindowMs = 100; // First 100ms after onset is "transient"
  const windowSamples = Math.floor((transientWindowMs / 1000) * sampleRate);

  let transientEnergy = 0;
  const markedAsTransient = new Set<number>();

  for (const onset of onsets) {
    for (let i = onset; i < onset + windowSamples && i < bassSignal.length; i++) {
      if (!markedAsTransient.has(i)) {
        transientEnergy += bassSignal[i] * bassSignal[i];
        markedAsTransient.add(i);
      }
    }
  }

  let totalEnergy = 0;
  for (const s of bassSignal) {
    totalEnergy += s * s;
  }

  return totalEnergy > 0 ? transientEnergy / totalEnergy : 0;
}

/**
 * Estimate fundamental frequency using zero-crossing rate.
 * Simple but effective for monophonic bass.
 */
function estimateFundamentalZCR(signal: Float32Array, sampleRate: number): number {
  let crossings = 0;
  let lastSample = 0;

  // Use middle section for stability
  const start = Math.floor(signal.length * 0.25);
  const end = Math.floor(signal.length * 0.75);

  for (let i = start; i < end; i++) {
    const s = signal[i];
    if ((lastSample < 0 && s >= 0) || (lastSample >= 0 && s < 0)) {
      crossings++;
    }
    lastSample = s;
  }

  const duration = (end - start) / sampleRate;
  const zcr = crossings / duration;

  // Rough estimate: fundamental ≈ ZCR / 2 (for sinusoidal)
  const estimatedFreq = zcr / 2;

  // Clamp to reasonable bass range
  return Math.max(30, Math.min(120, estimatedFreq));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWING DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export interface SwingResult {
  /** Swing amount 0-100% (0 = straight, 50 = triplet/shuffle) */
  swingPercent: number;
  /** Groove type */
  grooveType: 'straight' | 'slight-swing' | 'heavy-swing' | 'shuffle';
}

/**
 * Detect swing/groove by analyzing beat subdivision timing.
 * Uses the variance in beat durations as a proxy for swing detection.
 */
export function detectSwing(beatPositions: number[]): SwingResult {
  if (beatPositions.length < 8) {
    return { swingPercent: 0, grooveType: 'straight' };
  }

  // Calculate beat-to-beat intervals
  const intervals: number[] = [];
  for (let i = 1; i < beatPositions.length; i++) {
    intervals.push(beatPositions[i] - beatPositions[i - 1]);
  }

  if (intervals.length < 4) {
    return { swingPercent: 0, grooveType: 'straight' };
  }

  // Calculate mean and variance of intervals
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance =
    intervals.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (normalized std dev)
  const cv = mean > 0 ? stdDev / mean : 0;

  // Swing typically creates alternating long-short patterns
  // Calculate autocorrelation at lag 1 to detect alternation
  let alternatingSum = 0;
  for (let i = 0; i < intervals.length - 1; i++) {
    alternatingSum += (intervals[i] - mean) * (intervals[i + 1] - mean);
  }
  const alternatingCorr =
    intervals.length > 1 ? alternatingSum / (intervals.length - 1) / variance : 0;

  // Negative correlation at lag 1 suggests alternating pattern (swing)
  const hasAlternation = alternatingCorr < -0.1;

  // Estimate swing amount
  // High variation + alternation = swing
  let swingPercent = 0;
  if (hasAlternation && cv > 0.05) {
    swingPercent = Math.min(50, Math.max(0, cv * 400));
  }

  let grooveType: SwingResult['grooveType'];
  if (swingPercent < 10) grooveType = 'straight';
  else if (swingPercent < 25) grooveType = 'slight-swing';
  else if (swingPercent < 40) grooveType = 'heavy-swing';
  else grooveType = 'shuffle';

  return {
    swingPercent: Math.round(swingPercent),
    grooveType,
  };
}
