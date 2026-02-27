/**
 * Reverb Tail Analysis — RT60 Estimation
 *
 * Estimates reverberation time from recorded audio decay.
 * Works by finding transients and measuring energy decay slope.
 *
 * - Short RT60 (<0.3s): Dry studio sound (hard techno, hip-hop)
 * - Medium (0.3–0.8s): Moderate room (most club music)
 * - Long (>1.0s): Wet/spacious (dub-techno, ambient, dub)
 */

export interface ReverbAnalysisResult {
  /** Estimated RT60 in seconds. Capped at 3s. */
  rt60: number;
  /** True if RT60 > 0.5s (significant reverb) */
  isWet: boolean;
  /** Ratio of reverb tail energy to direct sound (0-1) */
  tailEnergyRatio: number;
}

const TRANSIENT_THRESHOLD_RATIO = 2.0; // Frame energy must be 2× running average to count
const MIN_TRANSIENTS = 4;
const ANALYSIS_WINDOW_S = 2.0;
const HOP_MS = 20; // 20ms hop for envelope

export function analyzeReverb(audioBuffer: AudioBuffer, bpm: number): ReverbAnalysisResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const hopSamples = Math.floor((HOP_MS / 1000) * sampleRate);

  // Step 1: Build RMS envelope at 20ms hop rate
  const envelope: number[] = [];
  for (let offset = 0; offset + hopSamples <= channelData.length; offset += hopSamples) {
    let sum = 0;
    for (let i = offset; i < offset + hopSamples; i++) {
      sum += channelData[i] * channelData[i];
    }
    envelope.push(Math.sqrt(sum / hopSamples));
  }

  if (envelope.length < 20) {
    return { rt60: 0.3, isWet: false, tailEnergyRatio: 0.1 };
  }

  // Step 2: Find transients (frames much louder than running average)
  const smoothWindow = 10; // 200ms running average
  const transientIndices: number[] = [];
  let runningAvg = 0;

  for (let i = 0; i < envelope.length; i++) {
    runningAvg =
      i < smoothWindow
        ? envelope.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1)
        : (runningAvg * (smoothWindow - 1) + envelope[i]) / smoothWindow;

    if (envelope[i] > runningAvg * TRANSIENT_THRESHOLD_RATIO && envelope[i] > 0.001) {
      // Enforce minimum distance (~half a beat)
      const minDistFrames = Math.floor(((60 / bpm) * 1000) / HOP_MS * 0.5);
      const lastTransient = transientIndices[transientIndices.length - 1] ?? -minDistFrames;
      if (i - lastTransient >= minDistFrames) {
        transientIndices.push(i);
      }
    }
  }

  if (transientIndices.length < MIN_TRANSIENTS) {
    return { rt60: 0.5, isWet: false, tailEnergyRatio: 0.2 };
  }

  // Step 3: For each transient, measure decay slope in dB
  const rt60Estimates: number[] = [];
  const tailRatios: number[] = [];

  for (let t = 0; t < transientIndices.length - 1; t++) {
    const startFrame = transientIndices[t];
    const peakEnergy = envelope[startFrame];
    if (peakEnergy < 0.001) continue;

    // Collect decay frames until next transient or ANALYSIS_WINDOW_S
    const maxDecayFrames = Math.floor((ANALYSIS_WINDOW_S * 1000) / HOP_MS);
    const endFrame = Math.min(
      startFrame + maxDecayFrames,
      transientIndices[t + 1] ?? envelope.length
    );

    const decayDb: number[] = [];
    let directEnergy = 0;
    let tailEnergy = 0;
    const directEndFrame = startFrame + Math.floor(50 / HOP_MS); // 50ms = direct sound

    for (let f = startFrame; f < endFrame; f++) {
      const e = envelope[f];
      if (f < directEndFrame) {
        directEnergy += e * e;
      } else {
        tailEnergy += e * e;
      }
      if (e > 0) {
        decayDb.push(20 * Math.log10(e / peakEnergy));
      }
    }

    if (decayDb.length < 5) continue;

    // Linear regression on decay curve: decayDb[i] = slope * i + intercept
    const n = decayDb.length;
    const xMean = (n - 1) / 2;
    const yMean = decayDb.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (decayDb[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slopeDbPerFrame = den !== 0 ? num / den : 0;
    if (slopeDbPerFrame >= 0) continue; // Not decaying

    const slopeDbPerSec = slopeDbPerFrame / (HOP_MS / 1000);
    const rt60 = Math.abs(-60 / slopeDbPerSec);
    if (rt60 > 0 && rt60 < 5) {
      rt60Estimates.push(rt60);
    }

    const totalEnergy = directEnergy + tailEnergy;
    if (totalEnergy > 0) {
      tailRatios.push(tailEnergy / totalEnergy);
    }
  }

  if (rt60Estimates.length === 0) {
    return { rt60: 0.3, isWet: false, tailEnergyRatio: 0.1 };
  }

  const avgRt60 = rt60Estimates.reduce((a, b) => a + b, 0) / rt60Estimates.length;
  const avgTailRatio =
    tailRatios.length > 0 ? tailRatios.reduce((a, b) => a + b, 0) / tailRatios.length : 0.2;

  return {
    rt60: Math.round(Math.min(3, avgRt60) * 100) / 100,
    isWet: avgRt60 > 0.5,
    tailEnergyRatio: Math.round(avgTailRatio * 100) / 100,
  };
}
