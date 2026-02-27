/**
 * Audio Feature Extraction
 *
 * Decodes audio files and extracts spectral features using the Web Audio API
 * and Meyda. This is the core analysis engine that feeds into the local provider.
 */

import { AudioFeatures, SpectralBandEnergy } from '../types';
import { detectBPM } from './bpmDetection';
import { detectKey } from './keyDetection';

// Spectral band definitions
const SPECTRAL_BANDS: { name: string; range: [number, number] }[] = [
  { name: 'Sub Bass', range: [20, 80] },
  { name: 'Low Bass', range: [80, 250] },
  { name: 'Low Mids', range: [250, 500] },
  { name: 'Mids', range: [500, 2000] },
  { name: 'Upper Mids', range: [2000, 5000] },
  { name: 'Highs', range: [5000, 10000] },
  { name: 'Brilliance', range: [10000, 20000] },
];

const FRAME_SIZE = 2048;
const BASE_HOP_SIZE = 1024;
const MAX_ANALYSIS_FRAMES = 6000;
const ONSET_THRESHOLD = 0.002;

function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

const HANN_WINDOW = createHannWindow(FRAME_SIZE);

/**
 * In-place radix-2 FFT for real/imag arrays of equal power-of-two length.
 */
function fftInPlace(real: Float32Array, imag: Float32Array): void {
  const n = real.length;

  // Bit-reversal permutation
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

  // Danielson-Lanczos stage loop
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

/**
 * Decode an audio File into an AudioBuffer using OfflineAudioContext.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  // Use OfflineAudioContext for decoding (works without user gesture).
  const tempCtx = new OfflineAudioContext(2, 1, 48000);
  return await tempCtx.decodeAudioData(arrayBuffer);
}

/**
 * Extract normalized waveform peaks for visualization.
 */
export function extractWaveformPeaks(audioBuffer: AudioBuffer, numBars: number = 320): number[] {
  if (numBars <= 0) return [];

  const channelCount = audioBuffer.numberOfChannels;
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  const blockSize = Math.max(1, Math.floor(audioBuffer.length / numBars));
  const peaks: number[] = [];
  let globalMax = 0;

  for (let i = 0; i < numBars; i++) {
    const start = i * blockSize;
    const end = Math.min(audioBuffer.length, start + blockSize);
    const stride = Math.max(1, Math.floor((end - start) / 128));

    let peak = 0;
    for (let sampleIdx = start; sampleIdx < end; sampleIdx += stride) {
      let mixed = 0;
      for (let c = 0; c < channelCount; c++) {
        mixed += Math.abs(channels[c][sampleIdx] ?? 0);
      }
      mixed /= channelCount;
      if (mixed > peak) peak = mixed;
    }

    peaks.push(peak);
    if (peak > globalMax) globalMax = peak;
  }

  if (globalMax <= 0) return peaks.map(() => 0);
  return peaks.map((value) => value / globalMax);
}

/**
 * Extract comprehensive audio features from an AudioBuffer.
 */
export function extractAudioFeatures(audioBuffer: AudioBuffer): AudioFeatures {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;

  // --- BPM Detection ---
  const { bpm, confidence: bpmConfidence } = detectBPM(audioBuffer);

  // --- Key Detection ---
  const key = detectKey(audioBuffer);

  // --- Frame-based analysis ---
  const analysisLength = channelData.length;
  const availableSamples = Math.max(0, analysisLength - FRAME_SIZE);
  const estimatedFrames = Math.floor(availableSamples / BASE_HOP_SIZE) + 1;
  const hopSize =
    estimatedFrames > MAX_ANALYSIS_FRAMES
      ? Math.max(BASE_HOP_SIZE, Math.floor(availableSamples / MAX_ANALYSIS_FRAMES))
      : BASE_HOP_SIZE;
  const numFrames = Math.max(1, Math.floor(availableSamples / hopSize) + 1);
  const fftHalf = FRAME_SIZE / 2;

  const rmsProfile: number[] = [];
  let spectralCentroidAcc = 0;
  let spectralCentroidCount = 0;
  let peakAmplitude = 0;
  let totalRms = 0;

  // Per-band energy accumulators
  const bandEnergies: number[][] = SPECTRAL_BANDS.map(() => []);
  const bandPeaks: number[] = SPECTRAL_BANDS.map(() => 0);
  const bandBinRanges = SPECTRAL_BANDS.map((band) => {
    const [lowHz, highHz] = band.range;
    const lowBin = Math.floor((lowHz * FRAME_SIZE) / sampleRate);
    const highBin = Math.min(Math.ceil((highHz * FRAME_SIZE) / sampleRate), fftHalf - 1);
    return [lowBin, highBin] as const;
  });

  // Onset detection: spectral flux
  let prevSpectrum: Float32Array | null = null;
  let onsetCount = 0;

  // FFT work buffers reused across frames.
  const real = new Float32Array(FRAME_SIZE);
  const imag = new Float32Array(FRAME_SIZE);
  const spectrum = new Float32Array(fftHalf);

  for (let frame = 0; frame < numFrames; frame++) {
    const start = Math.max(0, Math.min(frame * hopSize, analysisLength - FRAME_SIZE));

    // --- RMS ---
    let rmsSum = 0;
    for (let i = 0; i < FRAME_SIZE; i++) {
      const sample = channelData[start + i] ?? 0;
      rmsSum += sample * sample;
      const abs = Math.abs(sample);
      if (abs > peakAmplitude) peakAmplitude = abs;
      real[i] = sample * HANN_WINDOW[i];
      imag[i] = 0;
    }
    const rms = Math.sqrt(rmsSum / FRAME_SIZE);
    rmsProfile.push(rms);
    totalRms += rms;

    // --- FFT-based spectrum ---
    fftInPlace(real, imag);

    // --- Spectral Centroid ---
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let k = 0; k < fftHalf; k++) {
      // Normalize by N/2 so a full-scale sine yields magnitude ≈ 1.0 (0 dBFS)
      const mag = Math.hypot(real[k], imag[k]) / fftHalf;
      spectrum[k] = mag;
      const freq = (k * sampleRate) / FRAME_SIZE;
      weightedSum += freq * mag;
      magnitudeSum += mag;
    }
    if (magnitudeSum > 0) {
      spectralCentroidAcc += weightedSum / magnitudeSum;
      spectralCentroidCount++;
    }

    // --- Per-band energy ---
    for (let b = 0; b < SPECTRAL_BANDS.length; b++) {
      const [lowBin, highBin] = bandBinRanges[b];

      let bandSum = 0;
      for (let k = lowBin; k <= highBin; k++) {
        bandSum += spectrum[k] * spectrum[k];
      }
      const bandRms = Math.sqrt(bandSum / Math.max(1, highBin - lowBin + 1));
      bandEnergies[b].push(bandRms);
      if (bandRms > bandPeaks[b]) bandPeaks[b] = bandRms;
    }

    // --- Onset detection via spectral flux ---
    if (prevSpectrum) {
      let flux = 0;
      for (let k = 0; k < fftHalf; k++) {
        const diff = spectrum[k] - prevSpectrum[k];
        if (diff > 0) flux += diff;
      }
      const normalizedFlux = flux / fftHalf;
      if (normalizedFlux > ONSET_THRESHOLD) {
        onsetCount++;
      }
    }
    prevSpectrum = new Float32Array(spectrum);
  }

  // --- Aggregate metrics ---
  const rmsMean = numFrames > 0 ? totalRms / numFrames : 0;
  const spectralCentroidMean =
    spectralCentroidCount > 0 ? spectralCentroidAcc / spectralCentroidCount : 0;

  // Crest factor: peak-to-RMS ratio in dB
  const crestFactor = rmsMean > 0 ? 20 * Math.log10(peakAmplitude / rmsMean) : 0;

  // Onset density
  const onsetDensity = duration > 0 ? onsetCount / duration : 0;

  // --- Spectral band energies ---
  const spectralBands: SpectralBandEnergy[] = SPECTRAL_BANDS.map((band, i) => {
    const energyArr = bandEnergies[i];
    const avg = energyArr.length > 0 ? energyArr.reduce((a, b) => a + b, 0) / energyArr.length : 0;
    const peak = bandPeaks[i];

    const avgDb = avg > 0 ? 20 * Math.log10(avg) : -100;
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;

    let dominance: SpectralBandEnergy['dominance'] = 'absent';
    if (avgDb > -20) dominance = 'dominant';
    else if (avgDb > -35) dominance = 'present';
    else if (avgDb > -55) dominance = 'weak';

    return {
      name: band.name,
      rangeHz: band.range,
      averageDb: Math.round(avgDb * 10) / 10,
      peakDb: Math.round(peakDb * 10) / 10,
      dominance,
    };
  });

  return {
    bpm,
    bpmConfidence,
    key,
    spectralCentroidMean: Math.round(spectralCentroidMean),
    rmsMean,
    rmsProfile,
    spectralBands,
    crestFactor: Math.round(crestFactor * 10) / 10,
    onsetCount,
    onsetDensity: Math.round(onsetDensity * 10) / 10,
    duration,
    sampleRate,
    channels: audioBuffer.numberOfChannels,
  };
}
