/**
 * BPM Detection via Onset-based Autocorrelation
 *
 * Algorithm:
 * 1. Compute spectral flux (onset strength signal) from the audio
 * 2. Autocorrelate the onset signal to find periodicity
 * 3. Map the strongest autocorrelation lag to BPM
 * 4. Validate against musical tempo range (60-200 BPM)
 */

/**
 * Detect BPM from an AudioBuffer using onset-based autocorrelation.
 */
export function detectBPM(
  audioBuffer: AudioBuffer
): { bpm: number; confidence: number } {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // --- Step 1: Compute onset strength via energy difference ---
  const hopSize = 512;
  const frameSize = 1024;
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  if (numFrames < 2) {
    return { bpm: 120, confidence: 0 };
  }

  // Compute RMS energy per frame
  const energies: number[] = [];
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      const sample = channelData[start + j] ?? 0;
      sum += sample * sample;
    }
    energies.push(Math.sqrt(sum / frameSize));
  }

  // Onset strength = positive energy differences (half-wave rectified)
  const onsetSignal: number[] = [];
  for (let i = 1; i < energies.length; i++) {
    const diff = energies[i] - energies[i - 1];
    onsetSignal.push(diff > 0 ? diff : 0);
  }

  // --- Step 2: Autocorrelation of onset signal ---
  // BPM range: 60–200 => period in frames
  const framesPerSecond = sampleRate / hopSize;
  const minLag = Math.floor(framesPerSecond * (60 / 200)); // lag for 200 BPM
  const maxLag = Math.floor(framesPerSecond * (60 / 60));  // lag for 60 BPM
  const clampedMaxLag = Math.min(maxLag, onsetSignal.length - 1);

  if (minLag >= clampedMaxLag || onsetSignal.length < clampedMaxLag) {
    return { bpm: 120, confidence: 0 };
  }

  // Normalize onset signal
  const mean = onsetSignal.reduce((a, b) => a + b, 0) / onsetSignal.length;
  const normalized = onsetSignal.map(v => v - mean);

  // Compute autocorrelation for each candidate lag
  const correlations: { lag: number; value: number }[] = [];
  let maxCorr = 0;

  for (let lag = minLag; lag <= clampedMaxLag; lag++) {
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
    correlations.push({ lag, value: corr });
    if (corr > maxCorr) maxCorr = corr;
  }

  if (correlations.length === 0) {
    return { bpm: 120, confidence: 0 };
  }

  // --- Step 3: Find peaks in autocorrelation ---
  // Sort by correlation strength
  correlations.sort((a, b) => b.value - a.value);

  // Best candidate
  const bestLag = correlations[0].lag;
  const bestCorr = correlations[0].value;

  // Convert lag to BPM
  let bpm = (framesPerSecond / bestLag) * 60;

  // --- Step 4: Validate and adjust for half/double time ---
  // Prefer tempos in the 80-160 range (most common in electronic music)
  if (bpm > 160 && bpm <= 240) {
    bpm /= 2;
  } else if (bpm < 70 && bpm >= 30) {
    bpm *= 2;
  }

  // Round to 1 decimal place
  bpm = Math.round(bpm * 10) / 10;

  // Confidence: autocorrelation peak strength (0-1)
  const confidence = Math.max(0, Math.min(1, bestCorr));

  return { bpm, confidence };
}
