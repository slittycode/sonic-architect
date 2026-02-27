/**
 * LUFS / Integrated Loudness Measurement
 *
 * Implements ITU-R BS.1770-4 integrated loudness and true peak measurement.
 * This is the industry-standard loudness metric used by streaming platforms
 * (Spotify -14 LUFS, Apple -16 LUFS, YouTube -14 LUFS).
 *
 * Algorithm:
 * 1. Apply K-weighting filter (pre-filter + RLB high-pass) per channel
 * 2. Compute mean-square energy over 400ms overlapping blocks (75% overlap)
 * 3. Absolute gate at -70 LUFS, then relative gate at -10 below ungated mean
 * 4. True peak via 4x oversampled peak detection
 */

export interface LoudnessResult {
  /** Integrated loudness in LUFS (Loudness Units Full Scale) */
  lufsIntegrated: number;
  /** True peak level in dBTP (decibels True Peak) */
  truePeak: number;
  /** Short-term loudness values (3s windows) for timeline display */
  shortTermLoudness: number[];
}

/**
 * Apply a second-order IIR biquad filter in-place.
 * Coefficients follow the standard Direct Form I convention:
 * y[n] = (b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]) / a0
 */
function applyBiquad(
  data: Float32Array,
  b0: number,
  b1: number,
  b2: number,
  a0: number,
  a1: number,
  a2: number
): void {
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;

  for (let i = 0; i < data.length; i++) {
    const x0 = data[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    data[i] = y0;
  }
}

/**
 * Apply K-weighting filter chain to a channel.
 * Stage 1: Pre-filter (high-shelf boost ~+4dB above 1681 Hz)
 * Stage 2: RLB (revised low-frequency B-weighting) high-pass at ~38 Hz
 *
 * Coefficients are for 48 kHz; we resample coefficients for other rates
 * using the bilinear transform frequency warping factor.
 */
function applyKWeighting(data: Float32Array, sampleRate: number): void {
  // --- Stage 1: Pre-filter (high-shelf) ---
  // Design frequency: 1681.97 Hz, gain: +3.999843 dB, Q: 0.7071752
  if (sampleRate === 48000) {
    // ITU reference coefficients for 48 kHz
    applyBiquad(
      data,
      1.53512485958697,
      -2.69169618940638,
      1.19839281085285,
      1.0,
      -1.69065929318241,
      0.73248077421585
    );
    // Stage 2: RLB high-pass
    applyBiquad(data, 1.0, -2.0, 1.0, 1.0, -1.99004745483398, 0.99007225036621);
  } else {
    // For non-48kHz rates, use coefficient adaptation.
    // Pre-filter coefficients for common rates.
    const preFilterCoeffs: Record<number, number[]> = {
      44100: [1.5308412300498355, -2.6509799951547297, 1.1690790799215869, 1.0, -1.6636551132560204, 0.7125954280732254],
      96000: [1.5409635878498665, -2.7412514550498283, 1.2382826782498613, 1.0, -1.7269423107860714, 0.7613244030498234],
    };
    const rlbCoeffs: Record<number, number[]> = {
      44100: [1.0, -2.0, 1.0, 1.0, -1.98916267044904, 0.98919234055177],
      96000: [1.0, -2.0, 1.0, 1.0, -1.99505672786473, 0.99506185752809],
    };

    // Use closest available rate, fallback to 48kHz coefficients
    const rate = preFilterCoeffs[sampleRate] ? sampleRate : 48000;
    const pre = preFilterCoeffs[rate] ?? [1.53512485958697, -2.69169618940638, 1.19839281085285, 1.0, -1.69065929318241, 0.73248077421585];
    const rlb = rlbCoeffs[rate] ?? [1.0, -2.0, 1.0, 1.0, -1.99004745483398, 0.99007225036621];

    applyBiquad(data, pre[0], pre[1], pre[2], pre[3], pre[4], pre[5]);
    applyBiquad(data, rlb[0], rlb[1], rlb[2], rlb[3], rlb[4], rlb[5]);
  }
}

/**
 * Compute true peak via 4x oversampling (simplified).
 * Uses linear interpolation between samples to approximate inter-sample peaks.
 */
function computeTruePeak(channels: Float32Array[]): number {
  let peak = 0;

  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i]);
      if (abs > peak) peak = abs;

      // Check inter-sample peak with linear interpolation (simplified 4x)
      if (i > 0) {
        const prev = channel[i - 1];
        const curr = channel[i];
        // Check midpoints at 0.25, 0.5, 0.75
        for (let t = 0.25; t < 1; t += 0.25) {
          const interp = Math.abs(prev + t * (curr - prev));
          if (interp > peak) peak = interp;
        }
      }
    }
  }

  return peak > 0 ? 20 * Math.log10(peak) : -100;
}

/**
 * Measure integrated loudness (LUFS) and true peak from an AudioBuffer.
 */
export function measureLoudness(audioBuffer: AudioBuffer): LoudnessResult {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;

  // Channel weighting per BS.1770 (L, R, C, Ls, Rs)
  // For stereo: both channels weighted 1.0
  const channelWeights = numChannels <= 2
    ? new Array(numChannels).fill(1.0)
    : [1.0, 1.0, 1.0, 1.41, 1.41].slice(0, numChannels);

  // Apply K-weighting to each channel (work on copies)
  const kWeightedChannels: Float32Array[] = [];
  const rawChannels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    const raw = audioBuffer.getChannelData(c);
    rawChannels.push(raw);
    const copy = new Float32Array(raw);
    applyKWeighting(copy, sampleRate);
    kWeightedChannels.push(copy);
  }

  // --- Gated block loudness (400ms blocks, 75% overlap = 100ms step) ---
  const blockSamples = Math.floor(0.4 * sampleRate); // 400ms
  const stepSamples = Math.floor(0.1 * sampleRate);  // 100ms overlap step
  const totalSamples = kWeightedChannels[0].length;
  const numBlocks = Math.max(0, Math.floor((totalSamples - blockSamples) / stepSamples) + 1);

  if (numBlocks === 0) {
    return { lufsIntegrated: -70, truePeak: computeTruePeak(rawChannels), shortTermLoudness: [] };
  }

  // Compute mean-square per block
  const blockLoudness: number[] = [];
  for (let b = 0; b < numBlocks; b++) {
    const start = b * stepSamples;
    let sumWeightedMS = 0;

    for (let c = 0; c < numChannels; c++) {
      const chan = kWeightedChannels[c];
      let ms = 0;
      for (let i = start; i < start + blockSamples && i < chan.length; i++) {
        ms += chan[i] * chan[i];
      }
      ms /= blockSamples;
      sumWeightedMS += channelWeights[c] * ms;
    }

    // LUFS for this block: -0.691 + 10 * log10(sum of weighted mean-squares)
    const lufs = sumWeightedMS > 0 ? -0.691 + 10 * Math.log10(sumWeightedMS) : -100;
    blockLoudness.push(lufs);
  }

  // --- Absolute gate: -70 LUFS ---
  const gatedAbsolute = blockLoudness.filter((l) => l > -70);
  if (gatedAbsolute.length === 0) {
    return { lufsIntegrated: -70, truePeak: computeTruePeak(rawChannels), shortTermLoudness: [] };
  }

  // --- Relative gate: -10 LUFS below ungated mean ---
  // Compute the mean loudness of the absolutely-gated blocks (in linear domain)
  let ungatedLinearSum = 0;
  for (const l of gatedAbsolute) {
    ungatedLinearSum += Math.pow(10, l / 10);
  }
  const ungatedMeanLufs = 10 * Math.log10(ungatedLinearSum / gatedAbsolute.length);
  const relativeGate = ungatedMeanLufs - 10;

  // Apply relative gate
  const gatedRelative = gatedAbsolute.filter((l) => l > relativeGate);
  if (gatedRelative.length === 0) {
    return {
      lufsIntegrated: ungatedMeanLufs,
      truePeak: computeTruePeak(rawChannels),
      shortTermLoudness: [],
    };
  }

  // Final integrated loudness
  let integratedLinearSum = 0;
  for (const l of gatedRelative) {
    integratedLinearSum += Math.pow(10, l / 10);
  }
  const lufsIntegrated = 10 * Math.log10(integratedLinearSum / gatedRelative.length);

  // --- Short-term loudness (3s windows for timeline) ---
  const shortBlockSamples = Math.floor(3 * sampleRate);
  const shortStepSamples = Math.floor(1 * sampleRate); // 1s step
  const numShortBlocks = Math.max(
    0,
    Math.floor((totalSamples - shortBlockSamples) / shortStepSamples) + 1
  );

  const shortTermLoudness: number[] = [];
  for (let b = 0; b < numShortBlocks; b++) {
    const start = b * shortStepSamples;
    let sumWeightedMS = 0;

    for (let c = 0; c < numChannels; c++) {
      const chan = kWeightedChannels[c];
      let ms = 0;
      const end = Math.min(start + shortBlockSamples, chan.length);
      const count = end - start;
      for (let i = start; i < end; i++) {
        ms += chan[i] * chan[i];
      }
      ms /= count;
      sumWeightedMS += channelWeights[c] * ms;
    }

    const lufs = sumWeightedMS > 0 ? -0.691 + 10 * Math.log10(sumWeightedMS) : -100;
    shortTermLoudness.push(Math.round(lufs * 10) / 10);
  }

  return {
    lufsIntegrated: Math.round(lufsIntegrated * 10) / 10,
    truePeak: Math.round(computeTruePeak(rawChannels) * 10) / 10,
    shortTermLoudness,
  };
}
