/**
 * MFCC (Mel-Frequency Cepstral Coefficients)
 *
 * Computes 13 MFCCs from an AudioBuffer for timbre fingerprinting.
 * Pipeline: Windowed FFT → Mel filterbank (26 filters) → Log energy → DCT → 13 coefficients.
 *
 * Standard MIR feature set for instrument classification and timbral similarity.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const NUM_MEL_FILTERS = 26;
const NUM_MFCC = 13;
const FFT_SIZE = 2048;
const HOP_SIZE = 1024;

// ── Mel scale conversion ─────────────────────────────────────────────────────

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

// ── Hann window ──────────────────────────────────────────────────────────────

function createHannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}

// ── In-place radix-2 FFT ─────────────────────────────────────────────────────

function fftInPlace(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (-2 * Math.PI) / size;
    const wTemp = Math.sin(0.5 * theta);
    const wPr = -2 * wTemp * wTemp;
    const wPi = Math.sin(theta);
    for (let start = 0; start < n; start += size) {
      let wr = 1;
      let wi = 0;
      for (let m = 0; m < half; m++) {
        const i = start + m;
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
}

// ── Mel filterbank ───────────────────────────────────────────────────────────

/**
 * Build triangular mel-spaced filterbank.
 * Returns an array of filters, each mapping FFT bins → mel bin weight.
 */
function buildMelFilterbank(
  numFilters: number,
  fftSize: number,
  sampleRate: number
): { startBin: number; weights: number[] }[] {
  const fftHalf = fftSize / 2;
  const minHz = 0;
  const maxHz = sampleRate / 2;
  const minMel = hzToMel(minHz);
  const maxMel = hzToMel(maxHz);

  // Create numFilters + 2 equally spaced mel points
  const melPoints: number[] = [];
  for (let i = 0; i <= numFilters + 1; i++) {
    melPoints.push(minMel + (i * (maxMel - minMel)) / (numFilters + 1));
  }

  // Convert mel points to FFT bin indices
  const binPoints = melPoints.map((mel) => {
    const hz = melToHz(mel);
    return Math.round((hz * fftSize) / sampleRate);
  });

  const filters: { startBin: number; weights: number[] }[] = [];

  for (let m = 0; m < numFilters; m++) {
    const left = binPoints[m];
    const center = binPoints[m + 1];
    const right = binPoints[m + 2];

    const startBin = Math.max(0, left);
    const endBin = Math.min(fftHalf - 1, right);
    const weights: number[] = [];

    for (let k = startBin; k <= endBin; k++) {
      let weight = 0;
      if (k >= left && k < center && center > left) {
        weight = (k - left) / (center - left);
      } else if (k >= center && k <= right && right > center) {
        weight = (right - k) / (right - center);
      }
      weights.push(weight);
    }

    filters.push({ startBin, weights });
  }

  return filters;
}

// ── DCT-II ───────────────────────────────────────────────────────────────────

/**
 * Type-II DCT of a sequence, returning the first `numCoeffs` coefficients.
 */
function dctII(input: number[], numCoeffs: number): number[] {
  const N = input.length;
  const result: number[] = [];
  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[n] * Math.cos((Math.PI * k * (n + 0.5)) / N);
    }
    result.push(sum);
  }
  return result;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface MFCCResult {
  /** Mean MFCC coefficients (13 values) averaged across all frames. */
  mean: number[];
  /** Standard deviation of each MFCC across frames. */
  stddev: number[];
  /** Number of frames analyzed. */
  numFrames: number;
}

/**
 * Extract 13 MFCCs from an AudioBuffer.
 *
 * Returns the mean and standard deviation of each coefficient across all frames.
 * The mean vector is the standard timbre fingerprint; stddev captures timbral variation.
 */
export function extractMFCC(audioBuffer: AudioBuffer): MFCCResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const hannWindow = createHannWindow(FFT_SIZE);
  const filterbank = buildMelFilterbank(NUM_MEL_FILTERS, FFT_SIZE, sampleRate);
  const fftHalf = FFT_SIZE / 2;

  const numFrames = Math.max(1, Math.floor((channelData.length - FFT_SIZE) / HOP_SIZE) + 1);

  // Accumulate per-frame MFCCs
  const allMfccs: number[][] = [];

  const real = new Float32Array(FFT_SIZE);
  const imag = new Float32Array(FFT_SIZE);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * HOP_SIZE;

    // Windowed frame
    for (let i = 0; i < FFT_SIZE; i++) {
      real[i] = (channelData[start + i] ?? 0) * hannWindow[i];
      imag[i] = 0;
    }

    // FFT
    fftInPlace(real, imag);

    // Power spectrum
    const powerSpectrum = new Float32Array(fftHalf);
    for (let k = 0; k < fftHalf; k++) {
      powerSpectrum[k] = real[k] * real[k] + imag[k] * imag[k];
    }

    // Apply mel filterbank
    const melEnergies: number[] = [];
    for (const filter of filterbank) {
      let energy = 0;
      for (let i = 0; i < filter.weights.length; i++) {
        const bin = filter.startBin + i;
        if (bin < fftHalf) {
          energy += powerSpectrum[bin] * filter.weights[i];
        }
      }
      // Log energy (floor to avoid log(0))
      melEnergies.push(Math.log(Math.max(energy, 1e-10)));
    }

    // DCT to get MFCCs
    const mfcc = dctII(melEnergies, NUM_MFCC);
    allMfccs.push(mfcc);
  }

  // Compute mean and stddev across frames
  const mean: number[] = new Array(NUM_MFCC).fill(0);
  const stddev: number[] = new Array(NUM_MFCC).fill(0);

  for (const mfcc of allMfccs) {
    for (let c = 0; c < NUM_MFCC; c++) {
      mean[c] += mfcc[c];
    }
  }
  for (let c = 0; c < NUM_MFCC; c++) {
    mean[c] /= allMfccs.length;
  }

  for (const mfcc of allMfccs) {
    for (let c = 0; c < NUM_MFCC; c++) {
      const diff = mfcc[c] - mean[c];
      stddev[c] += diff * diff;
    }
  }
  for (let c = 0; c < NUM_MFCC; c++) {
    stddev[c] = Math.sqrt(stddev[c] / allMfccs.length);
  }

  // Round for cleaner output
  return {
    mean: mean.map((v) => Math.round(v * 1000) / 1000),
    stddev: stddev.map((v) => Math.round(v * 1000) / 1000),
    numFrames: allMfccs.length,
  };
}
