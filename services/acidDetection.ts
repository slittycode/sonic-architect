/**
 * Acid/TB-303 Bassline Detection
 *
 * Detects TB-303-style acid basslines using:
 * 1. Resonance peak detection in 100–800Hz (squelch characteristic)
 * 2. Spectral centroid oscillation in bass band (filter sweep detection)
 * 3. 16th-note bass rhythm density
 */

import { fftInPlace } from './audioAnalysis';

export interface AcidDetectionResult {
  isAcid: boolean;
  confidence: number;
  resonanceLevel: number; // 0-1, how peaked/resonant the bass is
  centroidOscillationHz: number; // Std dev of bass spectral centroid (filter sweep indicator)
  bassRhythmDensity: number; // Onsets per second in bass band
}

const ACID_BASS_LOW = 100;
const ACID_BASS_HIGH = 800;
const FRAME_SIZE = 2048;
const HOP_SIZE = 512;

export function detectAcidPattern(audioBuffer: AudioBuffer, bpm: number): AcidDetectionResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  const lowBin = Math.floor((ACID_BASS_LOW * FRAME_SIZE) / sampleRate);
  const highBin = Math.min(
    Math.ceil((ACID_BASS_HIGH * FRAME_SIZE) / sampleRate),
    FRAME_SIZE / 2 - 1
  );

  const centroids: number[] = [];
  const bandRms: number[] = [];
  let prevBandRms = 0;
  let onsetCount = 0;

  const real = new Float32Array(FRAME_SIZE);
  const imag = new Float32Array(FRAME_SIZE);

  for (let offset = 0; offset + FRAME_SIZE <= channelData.length; offset += HOP_SIZE) {
    for (let i = 0; i < FRAME_SIZE; i++) {
      real[i] = channelData[offset + i] ?? 0;
      imag[i] = 0;
    }
    fftInPlace(real, imag);

    // Per-frame band features
    let weightedSum = 0;
    let magnitudeSum = 0;
    let bandPower = 0;

    for (let k = lowBin; k <= highBin; k++) {
      const mag = Math.hypot(real[k], imag[k]) / (FRAME_SIZE / 2);
      const freq = (k * sampleRate) / FRAME_SIZE;
      weightedSum += freq * mag;
      magnitudeSum += mag;
      bandPower += mag * mag;
    }

    const centroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    centroids.push(centroid);

    const rms = Math.sqrt(bandPower / Math.max(1, highBin - lowBin + 1));
    bandRms.push(rms);

    // Onset in band (energy increase)
    if (rms > prevBandRms * 1.5 && rms > 0.001) onsetCount++;
    prevBandRms = rms;
  }

  if (centroids.length < 10) {
    return {
      isAcid: false,
      confidence: 0,
      resonanceLevel: 0,
      centroidOscillationHz: 0,
      bassRhythmDensity: 0,
    };
  }

  // Centroid oscillation (std dev = filter sweep indicator)
  const centroidMean = centroids.reduce((a, b) => a + b, 0) / centroids.length;
  const centroidVariance =
    centroids.reduce((acc, v) => acc + Math.pow(v - centroidMean, 2), 0) / centroids.length;
  const centroidOscillation = Math.sqrt(centroidVariance);

  // Resonance level: ratio of max bandRms frame to mean bandRms (peaky = resonant)
  const maxRms = Math.max(...bandRms);
  const meanRms = bandRms.reduce((a, b) => a + b, 0) / bandRms.length;
  const resonanceLevel = meanRms > 0 ? Math.min(1, (maxRms - meanRms) / meanRms) : 0;

  // Bass rhythm density
  const duration = audioBuffer.duration;
  const bassRhythmDensity = duration > 0 ? onsetCount / duration : 0;

  // Expected 16th-note density for acid patterns at this BPM
  const expected16thNoteDensity = (bpm / 60) * 4; // 4 16th notes per beat
  const rhythmScore = Math.min(1, bassRhythmDensity / (expected16thNoteDensity * 0.5));

  // Acid scoring: needs centroid oscillation AND resonance AND rhythm
  const centroidScore = Math.min(1, centroidOscillation / 100); // >100Hz swing = acid-like
  const confidence = centroidScore * 0.4 + resonanceLevel * 0.4 + rhythmScore * 0.2;
  const isAcid = confidence > 0.45;

  return {
    isAcid,
    confidence: Math.round(confidence * 100) / 100,
    resonanceLevel: Math.round(resonanceLevel * 100) / 100,
    centroidOscillationHz: Math.round(centroidOscillation),
    bassRhythmDensity: Math.round(bassRhythmDensity * 10) / 10,
  };
}
