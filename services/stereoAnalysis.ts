/**
 * Stereo Field Analysis
 *
 * Analyzes the spatial characteristics of stereo audio:
 * - Phase correlation (L×R / √(L²×R²)): +1=mono, 0=uncorrelated, -1=out-of-phase
 * - Stereo width: ratio of side (L-R) to mid (L+R) energy
 * - Per-band mono compatibility: flags frequency ranges with phase cancellation risk
 * - LR balance: per-band energy difference between channels
 */

export interface StereoFieldResult {
  /** Overall L/R phase correlation: -1 (out of phase) to +1 (mono). */
  phaseCorrelation: number;
  /** Stereo width: 0 (mono) to 1 (fully decorrelated). */
  stereoWidth: number;
  /** Whether the mix is mono-compatible (no significant phase cancellation). */
  monoCompatible: boolean;
  /** Per-band analysis for detailed stereo diagnostics. */
  bandAnalysis: StereoBandAnalysis[];
}

export interface StereoBandAnalysis {
  name: string;
  rangeHz: [number, number];
  /** L/R correlation for this band. */
  correlation: number;
  /** LR balance in dB (negative = left-heavy, positive = right-heavy). */
  balanceDb: number;
  /** Whether this band has phase cancellation risk (correlation < 0). */
  phaseCancellationRisk: boolean;
}

const STEREO_BANDS: { name: string; range: [number, number] }[] = [
  { name: 'Sub Bass', range: [20, 80] },
  { name: 'Low Bass', range: [80, 250] },
  { name: 'Low Mids', range: [250, 500] },
  { name: 'Mids', range: [500, 2000] },
  { name: 'Upper Mids', range: [2000, 5000] },
  { name: 'Highs', range: [5000, 10000] },
  { name: 'Brilliance', range: [10000, 20000] },
];

const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;

function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

const HANN = createHannWindow(FRAME_SIZE);

/**
 * In-place radix-2 FFT (same as audioAnalysis.ts).
 */
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
      const tmpR = real[i];
      real[i] = real[j];
      real[j] = tmpR;
      const tmpI = imag[i];
      imag[i] = imag[j];
      imag[j] = tmpI;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (-2 * Math.PI) / size;
    const wTemp = Math.sin(0.5 * theta);
    const wPr = -2 * wTemp * wTemp;
    const wPi = Math.sin(theta);
    for (let start = 0; start < n; start += size) {
      let wr = 1,
        wi = 0;
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

/**
 * Analyze the stereo field of an AudioBuffer.
 * Returns mono-analysis result for mono files (correlation=1, width=0).
 */
export function analyzeStereoField(audioBuffer: AudioBuffer): StereoFieldResult {
  const numChannels = audioBuffer.numberOfChannels;

  // Mono: trivial result
  if (numChannels < 2) {
    return {
      phaseCorrelation: 1,
      stereoWidth: 0,
      monoCompatible: true,
      bandAnalysis: STEREO_BANDS.map((b) => ({
        name: b.name,
        rangeHz: b.range,
        correlation: 1,
        balanceDb: 0,
        phaseCancellationRisk: false,
      })),
    };
  }

  const leftData = audioBuffer.getChannelData(0);
  const rightData = audioBuffer.getChannelData(1);
  const sampleRate = audioBuffer.sampleRate;
  const totalLength = Math.min(leftData.length, rightData.length);
  const fftHalf = FRAME_SIZE / 2;

  // --- Time-domain overall correlation ---
  let sumLR = 0,
    sumLL = 0,
    sumRR = 0;
  // Subsample for efficiency on long files
  const stride = Math.max(1, Math.floor(totalLength / 500000));
  for (let i = 0; i < totalLength; i += stride) {
    const l = leftData[i];
    const r = rightData[i];
    sumLR += l * r;
    sumLL += l * l;
    sumRR += r * r;
  }
  const denom = Math.sqrt(sumLL * sumRR);
  const phaseCorrelation = denom > 0 ? Math.round((sumLR / denom) * 100) / 100 : 1;

  // --- Stereo width: side/mid energy ratio ---
  let midEnergy = 0,
    sideEnergy = 0;
  for (let i = 0; i < totalLength; i += stride) {
    const mid = (leftData[i] + rightData[i]) * 0.5;
    const side = (leftData[i] - rightData[i]) * 0.5;
    midEnergy += mid * mid;
    sideEnergy += side * side;
  }
  const totalEnergy = midEnergy + sideEnergy;
  const stereoWidth = totalEnergy > 0 ? Math.round((sideEnergy / totalEnergy) * 100) / 100 : 0;

  // --- Per-band spectral analysis ---
  const numFrames = Math.max(1, Math.floor((totalLength - FRAME_SIZE) / HOP_SIZE));
  // Limit frames for performance
  const maxFrames = Math.min(numFrames, 3000);
  const frameStep = Math.max(1, Math.floor(numFrames / maxFrames));

  const bandBinRanges = STEREO_BANDS.map((band) => {
    const [lowHz, highHz] = band.range;
    const lowBin = Math.floor((lowHz * FRAME_SIZE) / sampleRate);
    const highBin = Math.min(Math.ceil((highHz * FRAME_SIZE) / sampleRate), fftHalf - 1);
    return [lowBin, highBin] as const;
  });

  // Accumulators per band: LR correlation and balance
  const bandLR: number[] = STEREO_BANDS.map(() => 0);
  const bandLL: number[] = STEREO_BANDS.map(() => 0);
  const bandRR: number[] = STEREO_BANDS.map(() => 0);
  const bandLeftEnergy: number[] = STEREO_BANDS.map(() => 0);
  const bandRightEnergy: number[] = STEREO_BANDS.map(() => 0);

  // FFT work buffers
  const realL = new Float32Array(FRAME_SIZE);
  const imagL = new Float32Array(FRAME_SIZE);
  const realR = new Float32Array(FRAME_SIZE);
  const imagR = new Float32Array(FRAME_SIZE);

  let framesProcessed = 0;
  for (let f = 0; f < numFrames; f += frameStep) {
    const start = Math.min(f * HOP_SIZE, totalLength - FRAME_SIZE);

    // Window and copy both channels
    for (let i = 0; i < FRAME_SIZE; i++) {
      realL[i] = (leftData[start + i] ?? 0) * HANN[i];
      imagL[i] = 0;
      realR[i] = (rightData[start + i] ?? 0) * HANN[i];
      imagR[i] = 0;
    }

    fftInPlace(realL, imagL);
    fftInPlace(realR, imagR);

    // Accumulate per-band cross-spectral and auto-spectral energy
    for (let b = 0; b < STEREO_BANDS.length; b++) {
      const [lowBin, highBin] = bandBinRanges[b];
      for (let k = lowBin; k <= highBin; k++) {
        const magL = realL[k] * realL[k] + imagL[k] * imagL[k];
        const magR = realR[k] * realR[k] + imagR[k] * imagR[k];
        // Cross-spectral (real part of L* × R)
        const crossReal = realL[k] * realR[k] + imagL[k] * imagR[k];
        bandLR[b] += crossReal;
        bandLL[b] += magL;
        bandRR[b] += magR;
        bandLeftEnergy[b] += magL;
        bandRightEnergy[b] += magR;
      }
    }
    framesProcessed++;
  }

  // Compute per-band metrics
  const bandAnalysis: StereoBandAnalysis[] = STEREO_BANDS.map((band, b) => {
    const denomB = Math.sqrt(bandLL[b] * bandRR[b]);
    const correlation = denomB > 0 ? Math.round((bandLR[b] / denomB) * 100) / 100 : 1;

    // Balance: dB difference between L and R energy
    const lDb = bandLeftEnergy[b] > 0 ? 10 * Math.log10(bandLeftEnergy[b]) : -100;
    const rDb = bandRightEnergy[b] > 0 ? 10 * Math.log10(bandRightEnergy[b]) : -100;
    const balanceDb = Math.round((rDb - lDb) * 10) / 10;

    // Phase cancellation risk: sub/bass bands with negative or very low correlation
    const isLowFreq = band.range[1] <= 250;
    const phaseCancellationRisk = isLowFreq ? correlation < 0.5 : correlation < 0;

    return {
      name: band.name,
      rangeHz: band.range,
      correlation,
      balanceDb,
      phaseCancellationRisk,
    };
  });

  // Mono compatible = no bands have phase cancellation risk
  const monoCompatible = bandAnalysis.every((b) => !b.phaseCancellationRisk);

  return {
    phaseCorrelation,
    stereoWidth,
    monoCompatible,
    bandAnalysis,
  };
}
