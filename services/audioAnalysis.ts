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

/**
 * Decode an audio File into an AudioBuffer using OfflineAudioContext.
 */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  // Use OfflineAudioContext for decoding (works without user gesture)
  const tempCtx = new OfflineAudioContext(1, 1, 44100);
  return await tempCtx.decodeAudioData(arrayBuffer);
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
  const frameSize = 2048;
  const hopSize = 1024;
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  const rmsProfile: number[] = [];
  const spectralCentroids: number[] = [];
  let peakAmplitude = 0;
  let totalRms = 0;

  // Per-band energy accumulators
  const bandEnergies: number[][] = SPECTRAL_BANDS.map(() => []);
  const bandPeaks: number[] = SPECTRAL_BANDS.map(() => 0);

  // Onset detection: spectral flux
  let prevSpectrum: Float64Array | null = null;
  let onsetCount = 0;
  const onsetThreshold = 0.015;

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;

    // --- RMS ---
    let rmsSum = 0;
    for (let i = 0; i < frameSize; i++) {
      const sample = channelData[start + i] ?? 0;
      rmsSum += sample * sample;
      const abs = Math.abs(sample);
      if (abs > peakAmplitude) peakAmplitude = abs;
    }
    const rms = Math.sqrt(rmsSum / frameSize);
    rmsProfile.push(rms);
    totalRms += rms;

    // --- FFT (simple DFT for spectral analysis) ---
    // We compute a magnitude spectrum using a basic approach
    const fftSize = frameSize;
    const spectrum = new Float64Array(fftSize / 2);

    // Apply Hann window and compute real FFT approximation
    // For efficiency, we compute magnitude at key frequency bins
    for (let k = 0; k < fftSize / 2; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < fftSize; n++) {
        const sample = (channelData[start + n] ?? 0);
        // Hann window
        const window = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (fftSize - 1)));
        const windowed = sample * window;
        const angle = (2 * Math.PI * k * n) / fftSize;
        real += windowed * Math.cos(angle);
        imag -= windowed * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }

    // --- Spectral Centroid ---
    let weightedSum = 0;
    let magnitudeSum = 0;
    for (let k = 0; k < spectrum.length; k++) {
      const freq = (k * sampleRate) / fftSize;
      weightedSum += freq * spectrum[k];
      magnitudeSum += spectrum[k];
    }
    if (magnitudeSum > 0) {
      spectralCentroids.push(weightedSum / magnitudeSum);
    }

    // --- Per-band energy ---
    for (let b = 0; b < SPECTRAL_BANDS.length; b++) {
      const [lowHz, highHz] = SPECTRAL_BANDS[b].range;
      const lowBin = Math.floor((lowHz * fftSize) / sampleRate);
      const highBin = Math.min(Math.ceil((highHz * fftSize) / sampleRate), spectrum.length - 1);

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
      for (let k = 0; k < spectrum.length; k++) {
        const diff = spectrum[k] - prevSpectrum[k];
        if (diff > 0) flux += diff;
      }
      if (flux > onsetThreshold) {
        onsetCount++;
      }
    }
    prevSpectrum = new Float64Array(spectrum);
  }

  // --- Aggregate metrics ---
  const rmsMean = numFrames > 0 ? totalRms / numFrames : 0;
  const spectralCentroidMean =
    spectralCentroids.length > 0
      ? spectralCentroids.reduce((a, b) => a + b, 0) / spectralCentroids.length
      : 0;

  // Crest factor: peak-to-RMS ratio in dB
  const crestFactor = rmsMean > 0 ? 20 * Math.log10(peakAmplitude / rmsMean) : 0;

  // Onset density
  const onsetDensity = duration > 0 ? onsetCount / duration : 0;

  // --- Spectral band energies ---
  const spectralBands: SpectralBandEnergy[] = SPECTRAL_BANDS.map((band, i) => {
    const energyArr = bandEnergies[i];
    const avg = energyArr.length > 0
      ? energyArr.reduce((a, b) => a + b, 0) / energyArr.length
      : 0;
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
