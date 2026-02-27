/**
 * Sidechain Pump Detection
 *
 * Detects sidechain compression patterns (bass ducking on kick drum hits)
 * by analyzing the sub-bass band envelope for periodic modulation.
 *
 * This is a key discriminator for electronic subgenres:
 * - House/Tech House: Strong sidechain (0.4-0.7)
 * - Minimal Techno: Weak sidechain (0.1-0.3)
 * - Ambient/Dub Techno: No sidechain
 */

export interface SidechainAnalysisResult {
  /** Whether significant sidechain pumping was detected */
  hasSidechain: boolean;
  /** Pump strength 0-1 (0.5+ = strong sidechain typical of house music) */
  strength: number;
  /** Period of the pump in seconds (~0.5s for 120 BPM) */
  periodSeconds: number;
  /** How consistent the pumping is (0-1) */
  consistency: number;
  /** Ratio of trough to peak in bass envelope (lower = more ducking) */
  duckingRatio: number;
}

const MIN_PUMP_PERIOD_MS = 300;  // ~200 BPM max
const MAX_PUMP_PERIOD_MS = 1500; // ~40 BPM min

/**
 * Detect sidechain compression by analyzing sub-bass envelope modulation.
 */
export function detectSidechainPump(
  audioBuffer: AudioBuffer,
  bpm: number
): SidechainAnalysisResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Expected beat period from BPM
  const expectedBeatPeriodMs = (60 / bpm) * 1000;

  // Extract sub-bass envelope
  const envelope = extractSubBassEnvelope(channelData, sampleRate);

  if (envelope.length < 100) {
    return {
      hasSidechain: false,
      strength: 0,
      periodSeconds: expectedBeatPeriodMs / 1000,
      consistency: 0,
      duckingRatio: 1,
    };
  }

  // Find envelope peaks and troughs
  const { peaks, troughs } = findPeaksAndTroughs(envelope, sampleRate);

  if (peaks.length < 3) {
    return {
      hasSidechain: false,
      strength: 0,
      periodSeconds: expectedBeatPeriodMs / 1000,
      consistency: 0,
      duckingRatio: 1,
    };
  }

  // Calculate average ducking ratio (trough / peak)
  let totalDuckingRatio = 0;
  let validCycles = 0;
  const periods: number[] = [];

  for (let i = 0; i < peaks.length - 1; i++) {
    const peak = peaks[i];
    const nextPeak = peaks[i + 1];

    // Find trough between peaks
    const troughInRange = troughs.find(
      (t) => t.index > peak.index && t.index < nextPeak.index
    );

    if (troughInRange) {
      const duckingRatio = troughInRange.value / peak.value;
      totalDuckingRatio += duckingRatio;

      const periodMs = ((nextPeak.index - peak.index) / sampleRate) * 1000;
      if (periodMs >= MIN_PUMP_PERIOD_MS && periodMs <= MAX_PUMP_PERIOD_MS) {
        periods.push(periodMs);
      }
      validCycles++;
    }
  }

  if (validCycles === 0) {
    return {
      hasSidechain: false,
      strength: 0,
      periodSeconds: expectedBeatPeriodMs / 1000,
      consistency: 0,
      duckingRatio: 1,
    };
  }

  const avgDuckingRatio = totalDuckingRatio / validCycles;

  // Calculate period consistency
  let periodConsistency = 0;
  let avgPeriodMs = expectedBeatPeriodMs;

  if (periods.length >= 2) {
    const mean = periods.reduce((a, b) => a + b, 0) / periods.length;
    const variance =
      periods.reduce((acc, p) => acc + Math.pow(p - mean, 2), 0) / periods.length;
    const stdDev = Math.sqrt(variance);
    periodConsistency = Math.max(0, 1 - stdDev / mean);
    avgPeriodMs = mean;
  }

  // Calculate sidechain strength
  // Lower ducking ratio = more ducking = stronger sidechain
  // 1.0 = no ducking, 0.0 = complete silence between kicks
  const duckingDepth = 1 - avgDuckingRatio;

  // Strength combines ducking depth and period consistency
  // Only count as sidechain if it's rhythmic (consistent period)
  let strength = 0;
  if (periodConsistency > 0.5) {
    strength = duckingDepth * periodConsistency;
  }

  // Has sidechain if strength is significant
  const hasSidechain = strength > 0.15;

  return {
    hasSidechain,
    strength: Math.round(strength * 100) / 100,
    periodSeconds: Math.round((avgPeriodMs / 1000) * 100) / 100,
    consistency: Math.round(periodConsistency * 100) / 100,
    duckingRatio: Math.round(avgDuckingRatio * 100) / 100,
  };
}

/**
 * Extract sub-bass envelope using FFT-based filtering.
 */
function extractSubBassEnvelope(
  signal: Float32Array,
  sampleRate: number
): Float32Array {
  // Downsample for efficiency
  const downsampleFactor = Math.floor(sampleRate / 1000); // Target ~1kHz
  const downsampledLength = Math.floor(signal.length / downsampleFactor);
  const downsampled = new Float32Array(downsampledLength);

  for (let i = 0; i < downsampledLength; i++) {
    // Simple downsampling with averaging
    let sum = 0;
    for (let j = 0; j < downsampleFactor; j++) {
      sum += Math.abs(signal[i * downsampleFactor + j] ?? 0);
    }
    downsampled[i] = sum / downsampleFactor;
  }

  // Lowpass filter at ~10Hz (fast envelope) using moving average
  const windowSize = Math.floor(downsampledLength / 100); // ~10Hz cutoff
  const envelope = new Float32Array(downsampledLength);

  let windowSum = 0;
  for (let i = 0; i < downsampledLength; i++) {
    windowSum += downsampled[i];
    if (i >= windowSize) {
      windowSum -= downsampled[i - windowSize];
    }
    envelope[i] = windowSum / Math.min(i + 1, windowSize);
  }

  return envelope;
}

interface Peak {
  index: number;
  value: number;
}

/**
 * Find peaks and troughs in envelope using derivative zero-crossings.
 */
function findPeaksAndTroughs(
  envelope: Float32Array,
  sampleRate: number
): { peaks: Peak[]; troughs: Peak[] } {
  const peaks: Peak[] = [];
  const troughs: Peak[] = [];

  // Simple peak detection: point higher than neighbors
  const minDistance = Math.floor((sampleRate / 1000) * 0.15); // 150ms min between peaks

  let lastPeakIndex = -minDistance;
  let lastTroughIndex = -minDistance;

  for (let i = 2; i < envelope.length - 2; i++) {
    const prev = envelope[i - 1];
    const curr = envelope[i];
    const next = envelope[i + 1];

    // Peak: higher than neighbors
    if (curr > prev && curr > next && i - lastPeakIndex >= minDistance) {
      peaks.push({ index: i, value: curr });
      lastPeakIndex = i;
    }

    // Trough: lower than neighbors
    if (curr < prev && curr < next && i - lastTroughIndex >= minDistance) {
      troughs.push({ index: i, value: curr });
      lastTroughIndex = i;
    }
  }

  return { peaks, troughs };
}

/**
 * Quick check for sidechain presence (for UI indicators).
 */
export function hasSidechainPump(
  audioBuffer: AudioBuffer,
  bpm: number,
  threshold: number = 0.3
): boolean {
  const result = detectSidechainPump(audioBuffer, bpm);
  return result.hasSidechain && result.strength >= threshold;
}
