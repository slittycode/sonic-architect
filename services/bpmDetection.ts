/**
 * BPM Detection via Multi-Method Onset Autocorrelation
 *
 * Algorithm:
 * 1. Compute spectral flux onset function (frequency-domain, not just energy)
 * 2. Combine with percussive energy onset for robustness
 * 3. Autocorrelate the combined onset signal to find periodicity
 * 4. Evaluate top candidates with harmonic consistency checking
 * 5. Validate against musical tempo range (60-200 BPM)
 *
 * Improvements over v1:
 * - Spectral flux catches tonal onsets (chord changes, melodic attacks)
 * - Percussive energy onset catches transients (kicks, snares)
 * - Harmonic checking prevents octave errors (detecting 60 BPM vs 120 BPM)
 * - Multi-candidate evaluation picks the musically coherent tempo
 */

const FRAME_SIZE = 1024;
const HOP_SIZE = 512;

/**
 * In-place radix-2 FFT for the onset function.
 * Produces magnitude spectrum in the real array (first half).
 */
function fftMagnitude(
  samples: Float32Array,
  start: number,
  size: number
): Float32Array {
  const real = new Float32Array(size);
  const imag = new Float32Array(size);

  // Apply Hann window and copy
  for (let i = 0; i < size; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
    real[i] = (samples[start + i] ?? 0) * window;
    imag[i] = 0;
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < size; i++) {
    let bit = size >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tmpR = real[i];
      real[i] = real[j];
      real[j] = tmpR;
      const tmpI = imag[i];
      imag[i] = imag[j];
      imag[j] = tmpI;
    }
  }

  // Danielson-Lanczos
  for (let len = 2; len <= size; len <<= 1) {
    const half = len >> 1;
    const theta = (-2 * Math.PI) / len;
    const wTemp = Math.sin(0.5 * theta);
    const wPr = -2 * wTemp * wTemp;
    const wPi = Math.sin(theta);

    for (let s = 0; s < size; s += len) {
      let wr = 1;
      let wi = 0;
      for (let m = 0; m < half; m++) {
        const i = s + m;
        const k = i + half;
        const tr = wr * real[k] - wi * imag[k];
        const ti = wr * imag[k] + wi * real[k];
        real[k] = real[i] - tr;
        imag[k] = imag[i] - ti;
        real[i] += tr;
        imag[i] += ti;
        const prevWr = wr;
        wr = wr + (wr * wPr - wi * wPi);
        wi = wi + (wi * wPr + prevWr * wPi);
      }
    }
  }

  // Compute magnitudes
  const mag = new Float32Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return mag;
}

/**
 * Compute spectral flux onset function.
 * For each frame, sum the positive differences in magnitude spectrum
 * compared to the previous frame. This catches tonal onsets that
 * simple energy difference misses (e.g., chord changes, synth attacks).
 */
function computeSpectralFluxOnset(
  channelData: Float32Array,
  numFrames: number
): number[] {
  const onset: number[] = [];
  let prevSpectrum: Float32Array | null = null;

  for (let i = 0; i < numFrames; i++) {
    const start = i * HOP_SIZE;
    const spectrum = fftMagnitude(channelData, start, FRAME_SIZE);

    if (prevSpectrum) {
      let flux = 0;
      for (let k = 0; k < spectrum.length; k++) {
        const diff = spectrum[k] - prevSpectrum[k];
        if (diff > 0) flux += diff; // Half-wave rectified
      }
      onset.push(flux);
    } else {
      onset.push(0);
    }

    prevSpectrum = spectrum;
  }

  return onset;
}

/**
 * Compute percussive energy onset function.
 * Uses sub-band energy in low frequencies (kick region: 40-150 Hz)
 * and high frequencies (snare/hat region: 2-8 kHz) for better
 * transient detection than full-band RMS.
 */
function computePercussiveOnset(
  channelData: Float32Array,
  sampleRate: number,
  numFrames: number
): number[] {
  const onset: number[] = [];
  let prevLowEnergy = 0;
  let prevHighEnergy = 0;

  for (let i = 0; i < numFrames; i++) {
    const start = i * HOP_SIZE;
    const spectrum = fftMagnitude(channelData, start, FRAME_SIZE);

    // Low band: 40-150 Hz (kick region)
    const lowBinStart = Math.floor((40 * FRAME_SIZE) / sampleRate);
    const lowBinEnd = Math.ceil((150 * FRAME_SIZE) / sampleRate);
    let lowEnergy = 0;
    for (let k = lowBinStart; k <= lowBinEnd && k < spectrum.length; k++) {
      lowEnergy += spectrum[k] * spectrum[k];
    }

    // High band: 2-8 kHz (snare/hat region)
    const highBinStart = Math.floor((2000 * FRAME_SIZE) / sampleRate);
    const highBinEnd = Math.ceil((8000 * FRAME_SIZE) / sampleRate);
    let highEnergy = 0;
    for (let k = highBinStart; k <= highBinEnd && k < spectrum.length; k++) {
      highEnergy += spectrum[k] * spectrum[k];
    }

    // Combined percussive onset: weighted sum of low + high band increases
    const lowDiff = Math.max(0, lowEnergy - prevLowEnergy);
    const highDiff = Math.max(0, highEnergy - prevHighEnergy);
    onset.push(lowDiff * 1.5 + highDiff); // Weight kick slightly more

    prevLowEnergy = lowEnergy;
    prevHighEnergy = highEnergy;
  }

  return onset;
}

/**
 * Combine two onset functions by normalizing and summing.
 */
function combineOnsets(a: number[], b: number[]): number[] {
  const len = Math.min(a.length, b.length);
  const maxA = Math.max(...a) || 1;
  const maxB = Math.max(...b) || 1;

  const combined: number[] = [];
  for (let i = 0; i < len; i++) {
    combined.push(a[i] / maxA + b[i] / maxB);
  }
  return combined;
}

/**
 * Find peaks in the autocorrelation function.
 * Returns the top N candidates sorted by strength.
 */
function findAutocorrelationPeaks(
  signal: number[],
  minLag: number,
  maxLag: number,
  topN: number = 5
): { lag: number; value: number }[] {
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const normalized = signal.map((v) => v - mean);

  const candidates: { lag: number; value: number }[] = [];

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let norm1 = 0;
    let norm2 = 0;
    const len = normalized.length - lag;

    for (let i = 0; i < len; i++) {
      sum += normalized[i] * normalized[i + lag];
      norm1 += normalized[i] * normalized[i];
      norm2 += normalized[i + lag] * normalized[i + lag];
    }

    const denom = Math.sqrt(norm1 * norm2);
    const corr = denom > 0 ? sum / denom : 0;

    // Only keep local peaks (higher than neighbors)
    if (candidates.length > 0) {
      const prev = candidates[candidates.length - 1];
      if (prev.lag === lag - 1 && prev.value < corr) {
        candidates[candidates.length - 1] = { lag, value: corr };
        continue;
      }
    }
    candidates.push({ lag, value: corr });
  }

  return candidates
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

/**
 * Evaluate candidate tempos for harmonic consistency.
 *
 * If candidate A is at lag L, check if there's also a peak near 2L (half tempo)
 * or L/2 (double tempo). Strong harmonic support increases confidence.
 * Prefer tempos where sub-harmonics also show correlation peaks.
 */
function evaluateCandidates(
  candidates: { lag: number; value: number }[],
  framesPerSecond: number
): { bpm: number; confidence: number } {
  if (candidates.length === 0) {
    return { bpm: 120, confidence: 0 };
  }

  let bestScore = -1;
  let bestBpm = 120;
  let bestConfidence = 0;

  for (const candidate of candidates) {
    const bpm = (framesPerSecond / candidate.lag) * 60;
    let score = candidate.value;

    // Check for harmonic support (sub-beat at double tempo)
    const halfLag = Math.round(candidate.lag / 2);
    const halfSupport = candidates.find(
      (c) => Math.abs(c.lag - halfLag) <= 2
    );
    if (halfSupport) {
      score += halfSupport.value * 0.3; // Bonus for harmonic consistency
    }

    // Check for sub-harmonic support (half tempo)
    const doubleLag = candidate.lag * 2;
    const doubleSupport = candidates.find(
      (c) => Math.abs(c.lag - doubleLag) <= 3
    );
    if (doubleSupport) {
      score += doubleSupport.value * 0.2;
    }

    // Prefer tempos in the 90-150 range (musical sweet spot)
    if (bpm >= 90 && bpm <= 150) {
      score *= 1.1;
    } else if (bpm >= 70 && bpm <= 180) {
      score *= 1.0;
    } else {
      score *= 0.8;
    }

    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
      bestConfidence = candidate.value;
    }
  }

  return { bpm: bestBpm, confidence: bestConfidence };
}

/**
 * Detect BPM from an AudioBuffer using multi-method onset autocorrelation.
 */
export function detectBPM(audioBuffer: AudioBuffer): {
  bpm: number;
  confidence: number;
} {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const numFrames = Math.floor((channelData.length - FRAME_SIZE) / HOP_SIZE);

  if (numFrames < 2) {
    return { bpm: 120, confidence: 0 };
  }

  // Step 1: Compute two complementary onset functions
  const spectralFlux = computeSpectralFluxOnset(channelData, numFrames);
  const percussive = computePercussiveOnset(channelData, sampleRate, numFrames);

  // Step 2: Combine onset functions
  const combined = combineOnsets(spectralFlux, percussive);

  // Step 3: Autocorrelation with candidate peak detection
  const framesPerSecond = sampleRate / HOP_SIZE;
  const minLag = Math.floor(framesPerSecond * (60 / 200)); // 200 BPM
  const maxLag = Math.floor(framesPerSecond * (60 / 60)); // 60 BPM
  const clampedMaxLag = Math.min(maxLag, combined.length - 1);

  if (minLag >= clampedMaxLag || combined.length < clampedMaxLag) {
    return { bpm: 120, confidence: 0 };
  }

  const candidates = findAutocorrelationPeaks(combined, minLag, clampedMaxLag, 8);

  // Step 4: Evaluate candidates with harmonic consistency
  let { bpm, confidence } = evaluateCandidates(candidates, framesPerSecond);

  // Step 5: Half/double time adjustment (prefer 80-160)
  if (bpm > 160 && bpm <= 240) {
    bpm /= 2;
  } else if (bpm < 70 && bpm >= 30) {
    bpm *= 2;
  }

  bpm = Math.round(bpm * 10) / 10;
  confidence = Math.max(0, Math.min(1, confidence));

  return { bpm, confidence };
}
