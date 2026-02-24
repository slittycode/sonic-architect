/**
 * Key Detection via Krumhansl-Schmuckler Algorithm
 *
 * Algorithm:
 * 1. Extract chroma features (12-bin pitch class energy) from audio
 * 2. Correlate against Krumhansl-Kessler major and minor key profiles
 * 3. Return the key with highest correlation
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Kessler key profiles (perceptual weightings)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const FRAME_SIZE = 4096;
const HOP_SIZE = 2048;
const MAX_KEY_FRAMES = 180;

interface GoertzelBin {
  pitchClass: number;
  coeff: number;
}

function buildGoertzelBins(sampleRate: number): GoertzelBin[] {
  const bins: GoertzelBin[] = [];
  // Check octaves 2-7 (C2 ~65Hz to B7 ~3951Hz)
  for (let octave = 2; octave <= 7; octave++) {
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
      const midiNote = octave * 12 + pitchClass;
      const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

      // Skip frequencies above Nyquist or below useful range
      if (freq > sampleRate / 2 || freq < 50) continue;

      const k = Math.round((freq * FRAME_SIZE) / sampleRate);
      const w = (2 * Math.PI * k) / FRAME_SIZE;
      bins.push({
        pitchClass,
        coeff: 2 * Math.cos(w),
      });
    }
  }
  return bins;
}

/**
 * Compute chroma features from an AudioBuffer.
 * Each chroma bin represents the energy of one pitch class (C, C#, D, ..., B).
 */
function computeChroma(audioBuffer: AudioBuffer): number[] {
  const sampleRate = audioBuffer.sampleRate;
  const data = audioBuffer.getChannelData(0);
  const chroma = new Float64Array(12);
  const numFrames = Math.floor((data.length - FRAME_SIZE) / HOP_SIZE);

  if (numFrames < 1) {
    return Array.from(chroma);
  }

  const goertzelBins = buildGoertzelBins(sampleRate);
  const frameStride = Math.max(1, Math.ceil(numFrames / MAX_KEY_FRAMES));

  // For each sampled frame, use precomputed Goertzel bins to accumulate chroma energy.
  for (let frame = 0; frame < numFrames; frame += frameStride) {
    const start = frame * HOP_SIZE;

    for (const bin of goertzelBins) {
      const { coeff, pitchClass } = bin;

      let s0 = 0;
      let s1 = 0;
      let s2 = 0;

      for (let i = 0; i < FRAME_SIZE; i++) {
        s0 = (data[start + i] ?? 0) + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }

      const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      chroma[pitchClass] += Math.max(0, power);
    }
  }

  // Normalize chroma
  const maxVal = Math.max(...chroma);
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxVal;
    }
  }

  return Array.from(chroma);
}

/**
 * Pearson correlation coefficient between two arrays.
 */
function correlate(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let num = 0;
  let denomA = 0;
  let denomB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  const denom = Math.sqrt(denomA * denomB);
  return denom > 0 ? num / denom : 0;
}

/**
 * Rotate a chroma array by `shift` positions (circular shift).
 * Used to test all key transpositions.
 */
function rotateChroma(chroma: number[], shift: number): number[] {
  const n = chroma.length;
  const shifted = new Array(n);
  for (let i = 0; i < n; i++) {
    shifted[i] = chroma[(i + shift) % n];
  }
  return shifted;
}

export interface KeyResult {
  root: string;
  scale: string;
  confidence: number;
}

/**
 * Detect the musical key of an AudioBuffer using the Krumhansl-Schmuckler algorithm.
 */
export function detectKey(audioBuffer: AudioBuffer): KeyResult {
  const chroma = computeChroma(audioBuffer);

  let bestCorr = -Infinity;
  let bestRoot = 0;
  let bestScale = 'Major';

  // Test all 12 major keys and 12 minor keys
  for (let root = 0; root < 12; root++) {
    const rotated = rotateChroma(chroma, root);

    const majorCorr = correlate(rotated, MAJOR_PROFILE);
    if (majorCorr > bestCorr) {
      bestCorr = majorCorr;
      bestRoot = root;
      bestScale = 'Major';
    }

    const minorCorr = correlate(rotated, MINOR_PROFILE);
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr;
      bestRoot = root;
      bestScale = 'Minor';
    }
  }

  // Confidence: correlation strength, mapped to 0-1 range
  // Typical correlations range from 0.3 (poor) to 0.9 (excellent)
  const confidence = Math.max(0, Math.min(1, (bestCorr + 0.5) / 1.5));

  return {
    root: NOTE_NAMES[bestRoot],
    scale: bestScale,
    confidence: Math.round(confidence * 100) / 100,
  };
}
