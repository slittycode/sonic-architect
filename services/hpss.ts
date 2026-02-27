/**
 * Harmonic/Percussive Source Separation (HPSS)
 *
 * Fitzgerald 2010: Median filtering on a spectrogram separates sustained
 * harmonic content (horizontal lines) from percussive transients (vertical lines).
 *
 * - Horizontal median → harmonic component (tones, chords, pads)
 * - Vertical median → percussive component (drums, transients)
 *
 * Used to improve key/chord detection (run on harmonic) and BPM/onset detection
 * (run on percussive) by removing interference between the two.
 */

const FRAME_SIZE = 2048;
const HOP_SIZE = 512;

export interface HPSSResult {
  /** Harmonic-only audio (sustained tones, no drums). */
  harmonic: Float32Array;
  /** Percussive-only audio (transients, no sustained tones). */
  percussive: Float32Array;
  sampleRate: number;
  duration: number;
}

function createHannWindow(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return w;
}

const HANN = createHannWindow(FRAME_SIZE);

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
      let tmp = real[i];
      real[i] = real[j];
      real[j] = tmp;
      tmp = imag[i];
      imag[i] = imag[j];
      imag[j] = tmp;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const theta = (-2 * Math.PI) / size;
    const wT = Math.sin(0.5 * theta);
    const wPr = -2 * wT * wT;
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
        const prev = wr;
        wr += wr * wPr - wi * wPi;
        wi += wi * wPr + prev * wPi;
      }
    }
  }
}

/** Inverse FFT via conjugation trick: IFFT(X) = conj(FFT(conj(X))) / N */
function ifftInPlace(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  // Conjugate input
  for (let i = 0; i < n; i++) imag[i] = -imag[i];
  fftInPlace(real, imag);
  // Conjugate and scale output
  for (let i = 0; i < n; i++) {
    real[i] /= n;
    imag[i] = -imag[i] / n;
  }
}

/**
 * Median of a small array. Copies and sorts (fine for kernel sizes ≤ ~30).
 */
function median(arr: number[]): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length & 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) * 0.5;
}

/**
 * Separate an AudioBuffer into harmonic and percussive components.
 *
 * @param audioBuffer Input audio (uses first channel if stereo)
 * @param harmonicKernel Median filter kernel size for harmonic (time-axis). Default 17.
 * @param percussiveKernel Median filter kernel size for percussive (frequency-axis). Default 17.
 */
export function separateHarmonicPercussive(
  audioBuffer: AudioBuffer,
  harmonicKernel: number = 17,
  percussiveKernel: number = 17
): HPSSResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const fftHalf = FRAME_SIZE / 2 + 1;

  // Limit analysis to avoid excessive memory on very long files
  const maxFrames = 4000;
  const numFrames = Math.min(
    maxFrames,
    Math.max(1, Math.floor((totalSamples - FRAME_SIZE) / HOP_SIZE) + 1)
  );
  const actualHop =
    numFrames >= maxFrames
      ? Math.floor((totalSamples - FRAME_SIZE) / maxFrames)
      : HOP_SIZE;

  // --- Build magnitude spectrogram and store phase ---
  const magnitudes: Float32Array[] = [];
  const phaseReal: Float32Array[] = [];
  const phaseImag: Float32Array[] = [];

  const real = new Float32Array(FRAME_SIZE);
  const imag = new Float32Array(FRAME_SIZE);

  for (let f = 0; f < numFrames; f++) {
    const start = Math.min(f * actualHop, totalSamples - FRAME_SIZE);

    for (let i = 0; i < FRAME_SIZE; i++) {
      real[i] = (channelData[start + i] ?? 0) * HANN[i];
      imag[i] = 0;
    }
    fftInPlace(real, imag);

    const mag = new Float32Array(fftHalf);
    const pR = new Float32Array(fftHalf);
    const pI = new Float32Array(fftHalf);
    for (let k = 0; k < fftHalf; k++) {
      mag[k] = Math.hypot(real[k], imag[k]);
      // Store unit phasor for reconstruction
      if (mag[k] > 0) {
        pR[k] = real[k] / mag[k];
        pI[k] = imag[k] / mag[k];
      }
    }
    magnitudes.push(mag);
    phaseReal.push(pR);
    phaseImag.push(pI);
  }

  // --- Median filtering ---
  const halfH = (harmonicKernel - 1) >> 1;
  const halfP = (percussiveKernel - 1) >> 1;

  // Harmonic mask: median filter along TIME axis (horizontal) for each freq bin
  const harmonicMag: Float32Array[] = magnitudes.map(() => new Float32Array(fftHalf));
  // Percussive mask: median filter along FREQUENCY axis (vertical) for each time frame
  const percussiveMag: Float32Array[] = magnitudes.map(() => new Float32Array(fftHalf));

  // Horizontal median (harmonic) — for each frequency bin, slide across time
  for (let k = 0; k < fftHalf; k++) {
    for (let f = 0; f < numFrames; f++) {
      const window: number[] = [];
      for (let t = Math.max(0, f - halfH); t <= Math.min(numFrames - 1, f + halfH); t++) {
        window.push(magnitudes[t][k]);
      }
      harmonicMag[f][k] = median(window);
    }
  }

  // Vertical median (percussive) — for each time frame, slide across frequency
  for (let f = 0; f < numFrames; f++) {
    for (let k = 0; k < fftHalf; k++) {
      const window: number[] = [];
      for (let b = Math.max(0, k - halfP); b <= Math.min(fftHalf - 1, k + halfP); b++) {
        window.push(magnitudes[f][b]);
      }
      percussiveMag[f][k] = median(window);
    }
  }

  // --- Soft masking: allocate original magnitude proportionally ---
  // H_mask = H^2 / (H^2 + P^2), P_mask = P^2 / (H^2 + P^2)
  const hMasked: Float32Array[] = magnitudes.map(() => new Float32Array(fftHalf));
  const pMasked: Float32Array[] = magnitudes.map(() => new Float32Array(fftHalf));

  for (let f = 0; f < numFrames; f++) {
    for (let k = 0; k < fftHalf; k++) {
      const h2 = harmonicMag[f][k] * harmonicMag[f][k];
      const p2 = percussiveMag[f][k] * percussiveMag[f][k];
      const denom = h2 + p2;
      const orig = magnitudes[f][k];
      if (denom > 0) {
        hMasked[f][k] = orig * (h2 / denom);
        pMasked[f][k] = orig * (p2 / denom);
      }
    }
  }

  // --- Reconstruct time-domain signals via overlap-add ---
  const outputLength = (numFrames - 1) * actualHop + FRAME_SIZE;
  const harmonic = new Float32Array(outputLength);
  const percussive = new Float32Array(outputLength);
  const windowSum = new Float32Array(outputLength);

  const synthReal = new Float32Array(FRAME_SIZE);
  const synthImag = new Float32Array(FRAME_SIZE);

  for (let f = 0; f < numFrames; f++) {
    const start = f * actualHop;

    // --- Harmonic reconstruction ---
    synthReal.fill(0);
    synthImag.fill(0);
    for (let k = 0; k < fftHalf; k++) {
      synthReal[k] = hMasked[f][k] * phaseReal[f][k];
      synthImag[k] = hMasked[f][k] * phaseImag[f][k];
      // Mirror for real-valued IFFT
      if (k > 0 && k < FRAME_SIZE / 2) {
        synthReal[FRAME_SIZE - k] = synthReal[k];
        synthImag[FRAME_SIZE - k] = -synthImag[k];
      }
    }
    ifftInPlace(synthReal, synthImag);
    for (let i = 0; i < FRAME_SIZE; i++) {
      harmonic[start + i] += synthReal[i] * HANN[i];
    }

    // --- Percussive reconstruction ---
    synthReal.fill(0);
    synthImag.fill(0);
    for (let k = 0; k < fftHalf; k++) {
      synthReal[k] = pMasked[f][k] * phaseReal[f][k];
      synthImag[k] = pMasked[f][k] * phaseImag[f][k];
      if (k > 0 && k < FRAME_SIZE / 2) {
        synthReal[FRAME_SIZE - k] = synthReal[k];
        synthImag[FRAME_SIZE - k] = -synthImag[k];
      }
    }
    ifftInPlace(synthReal, synthImag);
    for (let i = 0; i < FRAME_SIZE; i++) {
      percussive[start + i] += synthReal[i] * HANN[i];
    }

    // Window normalization accumulator
    for (let i = 0; i < FRAME_SIZE; i++) {
      windowSum[start + i] += HANN[i] * HANN[i];
    }
  }

  // Normalize by window sum to remove overlap-add amplitude modulation
  for (let i = 0; i < outputLength; i++) {
    if (windowSum[i] > 1e-8) {
      harmonic[i] /= windowSum[i];
      percussive[i] /= windowSum[i];
    }
  }

  return {
    harmonic,
    percussive,
    sampleRate,
    duration: audioBuffer.duration,
  };
}

/**
 * Wrap a Float32Array as a minimal AudioBuffer-like object for consumption
 * by detectKey() and detectChords() which expect AudioBuffer.
 */
export function wrapAsAudioBuffer(
  data: Float32Array,
  sampleRate: number
): AudioBuffer {
  return {
    sampleRate,
    numberOfChannels: 1,
    length: data.length,
    duration: data.length / sampleRate,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}
