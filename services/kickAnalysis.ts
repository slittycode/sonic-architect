/**
 * Kick Drum Distortion Analysis
 *
 * Detects distorted kick drums characteristic of Hard Techno, Industrial Techno,
 * and Hardstyle. Uses Total Harmonic Distortion (THD) measurement and harmonic
 * vs inharmonic content analysis.
 *
 * Key discriminators:
 * - Clean kicks (House, Techno): Low THD (<10%), strong fundamental
 * - Distorted kicks (Hard/Industrial): High THD (>20%), high harmonic content
 */

import { fftInPlace } from './audioAnalysis';

export interface KickAnalysisResult {
  /** Whether distorted kick was detected */
  isDistorted: boolean;
  /** Total Harmonic Distortion ratio (0-1) */
  thd: number;
  /** Ratio of harmonic to inharmonic content (0-1) */
  harmonicRatio: number;
  /** Average kick fundamental frequency in Hz */
  fundamentalHz: number;
  /** Number of kick transients detected */
  kickCount: number;
}

const KICK_LOW_HZ = 30;
const KICK_HIGH_HZ = 120;
const FRAME_SIZE = 2048;
const HOP_SIZE = 256; // Fine resolution for transient detection

/**
 * Analyze kick drum distortion characteristics.
 */
export function analyzeKickDistortion(
  audioBuffer: AudioBuffer,
  bpm: number
): KickAnalysisResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Step 1: Detect kick transients
  const kickTransients = detectKickTransients(channelData, sampleRate, bpm);

  if (kickTransients.length < 2) {
    return {
      isDistorted: false,
      thd: 0,
      harmonicRatio: 0,
      fundamentalHz: 50,
      kickCount: kickTransients.length,
    };
  }

  // Step 2: Analyze each kick for distortion
  const thdValues: number[] = [];
  const harmonicRatios: number[] = [];
  const fundamentals: number[] = [];

  for (const transient of kickTransients) {
    const analysis = analyzeKickFrame(
      channelData,
      transient.sampleIndex,
      sampleRate
    );
    thdValues.push(analysis.thd);
    harmonicRatios.push(analysis.harmonicRatio);
    fundamentals.push(analysis.fundamentalHz);
  }

  // Average across all kicks
  const avgThd = thdValues.reduce((a, b) => a + b, 0) / thdValues.length;
  const avgHarmonicRatio =
    harmonicRatios.reduce((a, b) => a + b, 0) / harmonicRatios.length;
  const avgFundamental =
    fundamentals.reduce((a, b) => a + b, 0) / fundamentals.length;

  // Distorted if THD > 15% or harmonic ratio < 0.5 (more inharmonic content)
  const isDistorted = avgThd > 0.15 || avgHarmonicRatio < 0.5;

  return {
    isDistorted,
    thd: Math.round(avgThd * 100) / 100,
    harmonicRatio: Math.round(avgHarmonicRatio * 100) / 100,
    fundamentalHz: Math.round(avgFundamental),
    kickCount: kickTransients.length,
  };
}

interface KickTransient {
  sampleIndex: number;
  energy: number;
}

/**
 * Detect kick drum transients using energy-based detection in kick frequency range.
 */
function detectKickTransients(
  channelData: Float32Array,
  sampleRate: number,
  bpm: number
): KickTransient[] {
  const transients: KickTransient[] = [];

  // Expected minimum distance between kicks (based on BPM)
  // Allow for 16th note patterns
  const beatDurationMs = (60 / bpm) * 1000;
  const minDistanceMs = beatDurationMs / 4; // 16th notes
  const minDistanceSamples = Math.floor((minDistanceMs / 1000) * sampleRate);

  // Build energy envelope in kick frequency range
  const envelope = buildKickEnvelope(channelData, sampleRate);

  // Find peaks in envelope
  let lastTransientIndex = -minDistanceSamples;

  for (let i = 2; i < envelope.length - 2; i++) {
    const prev = envelope[i - 1];
    const curr = envelope[i];
    const next = envelope[i + 1];

    // Peak detection with minimum distance
    if (
      curr > prev &&
      curr > next &&
      curr > 0.01 && // Minimum energy threshold
      i - lastTransientIndex >= minDistanceSamples
    ) {
      transients.push({
        sampleIndex: i * HOP_SIZE,
        energy: curr,
      });
      lastTransientIndex = i;
    }
  }

  return transients;
}

/**
 * Build energy envelope in kick frequency range (30-120Hz).
 */
function buildKickEnvelope(
  channelData: Float32Array,
  sampleRate: number
): number[] {
  const envelope: number[] = [];
  const real = new Float32Array(FRAME_SIZE);
  const imag = new Float32Array(FRAME_SIZE);

  const lowBin = Math.floor((KICK_LOW_HZ * FRAME_SIZE) / sampleRate);
  const highBin = Math.min(
    Math.ceil((KICK_HIGH_HZ * FRAME_SIZE) / sampleRate),
    FRAME_SIZE / 2 - 1
  );

  for (
    let offset = 0;
    offset + FRAME_SIZE <= channelData.length;
    offset += HOP_SIZE
  ) {
    // Apply window and FFT
    for (let i = 0; i < FRAME_SIZE; i++) {
      real[i] = channelData[offset + i] ?? 0;
      imag[i] = 0;
    }
    fftInPlace(real, imag);

    // Energy in kick frequency range
    let kickEnergy = 0;
    for (let k = lowBin; k <= highBin; k++) {
      kickEnergy += real[k] * real[k] + imag[k] * imag[k];
    }

    envelope.push(Math.sqrt(kickEnergy / (highBin - lowBin + 1)));
  }

  return envelope;
}

interface KickAnalysis {
  thd: number;
  harmonicRatio: number;
  fundamentalHz: number;
}

/**
 * Analyze a single kick transient for distortion characteristics.
 */
function analyzeKickFrame(
  channelData: Float32Array,
  startSample: number,
  sampleRate: number
): KickAnalysis {
  // Extract kick frame (typically 50-100ms for kick body)
  const frameLength = Math.floor(0.08 * sampleRate); // 80ms
  const frame = new Float32Array(FRAME_SIZE);

  // Copy kick frame with windowing
  const windowStart = startSample;
  const windowEnd = Math.min(startSample + frameLength, channelData.length);

  // Apply Hann window
  for (let i = 0; i < FRAME_SIZE; i++) {
    const sampleIdx = windowStart + i;
    if (sampleIdx < windowEnd) {
      const windowVal = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FRAME_SIZE - 1)));
      frame[i] = (channelData[sampleIdx] ?? 0) * windowVal;
    } else {
      frame[i] = 0;
    }
  }

  // FFT analysis
  const real = new Float32Array(frame);
  const imag = new Float32Array(FRAME_SIZE);
  fftInPlace(real, imag);

  // Find fundamental frequency (strongest peak in 30-120Hz range)
  const lowBin = Math.floor((KICK_LOW_HZ * FRAME_SIZE) / sampleRate);
  const highBin = Math.min(
    Math.ceil((KICK_HIGH_HZ * FRAME_SIZE) / sampleRate),
    FRAME_SIZE / 2 - 1
  );

  let maxMagnitude = 0;
  let fundamentalBin = lowBin;

  for (let k = lowBin; k <= highBin; k++) {
    const magnitude = Math.hypot(real[k], imag[k]);
    if (magnitude > maxMagnitude) {
      maxMagnitude = magnitude;
      fundamentalBin = k;
    }
  }

  const fundamentalHz = (fundamentalBin * sampleRate) / FRAME_SIZE;

  // Calculate THD (Total Harmonic Distortion)
  // THD = sqrt(sum of harmonic powers) / fundamental power
  const fundamentalPower = maxMagnitude * maxMagnitude;
  let harmonicPower = 0;

  // Check harmonics up to 10th harmonic or Nyquist
  const maxHarmonic = Math.min(10, Math.floor((sampleRate / 2) / fundamentalHz));

  for (let h = 2; h <= maxHarmonic; h++) {
    const harmonicBin = Math.round(fundamentalBin * h);
    if (harmonicBin < FRAME_SIZE / 2) {
      const harmonicMagnitude = Math.hypot(
        real[harmonicBin],
        imag[harmonicBin]
      );
      harmonicPower += harmonicMagnitude * harmonicMagnitude;
    }
  }

  const thd =
    fundamentalPower > 0 ? Math.sqrt(harmonicPower) / Math.sqrt(fundamentalPower) : 0;

  // Calculate harmonic vs inharmonic ratio
  // Harmonic content: energy at harmonic frequencies
  // Inharmonic content: energy between harmonics (noise, distortion products)
  let harmonicEnergy = 0;
  let inharmonicEnergy = 0;

  for (let k = lowBin; k <= highBin; k++) {
    const magnitude = Math.hypot(real[k], imag[k]);
    const freq = (k * sampleRate) / FRAME_SIZE;

    // Check if this bin is close to a harmonic
    const isHarmonic = isCloseToHarmonic(
      freq,
      fundamentalHz,
      sampleRate / FRAME_SIZE
    );

    if (isHarmonic) {
      harmonicEnergy += magnitude * magnitude;
    } else {
      inharmonicEnergy += magnitude * magnitude;
    }
  }

  const totalEnergy = harmonicEnergy + inharmonicEnergy;
  const harmonicRatio = totalEnergy > 0 ? harmonicEnergy / totalEnergy : 0;

  return {
    thd: Math.min(1, thd), // Cap at 1.0
    harmonicRatio,
    fundamentalHz,
  };
}

/**
 * Check if a frequency is close to any harmonic of the fundamental.
 */
function isCloseToHarmonic(
  freq: number,
  fundamentalHz: number,
  binWidth: number
): boolean {
  const harmonicTolerance = binWidth * 1.5; // 1.5 bins tolerance

  for (let h = 1; h <= 10; h++) {
    const harmonicFreq = fundamentalHz * h;
    if (Math.abs(freq - harmonicFreq) < harmonicTolerance) {
      return true;
    }
  }

  return false;
}

/**
 * Quick check for distorted kicks (for UI indicators).
 */
export function hasDistortedKick(
  audioBuffer: AudioBuffer,
  bpm: number,
  threshold: number = 0.15
): boolean {
  const result = analyzeKickDistortion(audioBuffer, bpm);
  return result.isDistorted && result.thd >= threshold;
}
