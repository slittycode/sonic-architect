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
export function detectBPM(audioBuffer: AudioBuffer): { bpm: number; confidence: number } {
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
  const maxLag = Math.floor(framesPerSecond * (60 / 60)); // lag for 60 BPM
  const clampedMaxLag = Math.min(maxLag, onsetSignal.length - 1);

  if (minLag >= clampedMaxLag || onsetSignal.length < clampedMaxLag) {
    return { bpm: 120, confidence: 0 };
  }

  // Normalize onset signal
  const mean = onsetSignal.reduce((a, b) => a + b, 0) / onsetSignal.length;
  const normalized = onsetSignal.map((v) => v - mean);

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

// --- Dynamic Programming Beat Tracker ---

export interface BeatTrackResult {
  /** Beat positions in seconds. */
  beats: number[];
  /** Estimated downbeat (bar "1") position in seconds. */
  downbeat: number;
  /** Tempo used for tracking. */
  bpm: number;
}

/**
 * Track individual beat positions using dynamic programming.
 *
 * Given a tempo hypothesis (from detectBPM), finds the sequence of onset peaks
 * that best aligns with a regular beat grid, allowing local tempo variation.
 * Also identifies the downbeat via onset-energy accumulation at candidate phases.
 *
 * Dixon 2001 / Ellis 2007 style DP beat tracker.
 */
export function trackBeats(audioBuffer: AudioBuffer, tempoHint?: number): BeatTrackResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  const hopSize = 512;
  const frameSize = 1024;
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  if (numFrames < 4) {
    return { beats: [], downbeat: 0, bpm: tempoHint ?? 120 };
  }

  // --- Onset strength function (same as detectBPM) ---
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

  const onset: number[] = [0];
  for (let i = 1; i < energies.length; i++) {
    const diff = energies[i] - energies[i - 1];
    onset.push(diff > 0 ? diff : 0);
  }

  // Normalize onset to [0, 1]
  const maxOnset = Math.max(...onset);
  if (maxOnset > 0) {
    for (let i = 0; i < onset.length; i++) onset[i] /= maxOnset;
  }

  // --- DP beat tracking ---
  const bpm = tempoHint ?? detectBPM(audioBuffer).bpm;
  const framesPerSecond = sampleRate / hopSize;
  const beatPeriod = Math.round((framesPerSecond * 60) / bpm);

  if (beatPeriod < 2) {
    return { beats: [], downbeat: 0, bpm };
  }

  // Transition penalty weight: how much we penalise deviating from the ideal period
  const lambda = 100;

  // DP score and backpointer arrays
  const score = new Float64Array(onset.length);
  const backPtr = new Int32Array(onset.length).fill(-1);

  // Allowed deviation from ideal beat period: ±20%
  const minStep = Math.max(1, Math.round(beatPeriod * 0.8));
  const maxStep = Math.round(beatPeriod * 1.2);

  // Initialize: first potential beats just get onset strength
  for (let i = 0; i < Math.min(onset.length, maxStep); i++) {
    score[i] = onset[i];
  }

  // Fill DP table
  for (let i = minStep; i < onset.length; i++) {
    let bestPrev = -Infinity;
    let bestJ = -1;
    const searchStart = Math.max(0, i - maxStep);
    const searchEnd = i - minStep;

    for (let j = searchStart; j <= searchEnd; j++) {
      // Penalty: squared log-deviation from ideal period
      const step = i - j;
      const deviation = Math.log2(step / beatPeriod);
      const penalty = lambda * deviation * deviation;
      const candidate = score[j] - penalty;

      if (candidate > bestPrev) {
        bestPrev = candidate;
        bestJ = j;
      }
    }

    if (bestJ >= 0) {
      const dpScore = bestPrev + onset[i];
      if (dpScore > score[i]) {
        score[i] = dpScore;
        backPtr[i] = bestJ;
      }
    }
  }

  // --- Backtrace from the best-scoring endpoint ---
  let bestEnd = 0;
  let bestEndScore = -Infinity;
  // Look in the last 2 beat periods for the endpoint
  const endSearchStart = Math.max(0, onset.length - beatPeriod * 2);
  for (let i = endSearchStart; i < onset.length; i++) {
    if (score[i] > bestEndScore) {
      bestEndScore = score[i];
      bestEnd = i;
    }
  }

  const beatFrames: number[] = [];
  let current = bestEnd;
  while (current >= 0) {
    beatFrames.push(current);
    current = backPtr[current];
  }
  beatFrames.reverse();

  // Convert frame indices to seconds
  const beats = beatFrames.map((f) => Math.round(((f * hopSize) / sampleRate) * 1000) / 1000);

  // --- Downbeat detection ---
  // Accumulate onset energy at each candidate phase within a 4-beat window.
  // The phase with highest total energy is likely the downbeat.
  const beatsPerBar = 4;
  let bestPhase = 0;
  let bestPhaseEnergy = -Infinity;

  for (let phase = 0; phase < Math.min(beatsPerBar, beats.length); phase++) {
    let energy = 0;
    for (let b = phase; b < beatFrames.length; b += beatsPerBar) {
      energy += onset[beatFrames[b]] ?? 0;
    }
    if (energy > bestPhaseEnergy) {
      bestPhaseEnergy = energy;
      bestPhase = phase;
    }
  }

  const downbeat = beats[bestPhase] ?? beats[0] ?? 0;

  return { beats, downbeat, bpm };
}
