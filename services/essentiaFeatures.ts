/**
 * Essentia.js WASM Feature Extraction
 *
 * Lazy-loaded singleton — WASM only loads when first requested.
 * Extracts features unavailable in the custom DSP pipeline:
 * - dissonance: harmonic roughness (high = acid/industrial)
 * - hfc: high frequency content (hi-hat/percussive energy)
 * - spectralComplexity: number of spectral peaks (minimal vs maximal)
 * - zeroCrossingRate: noise/percussion content
 */

export interface EssentiaFeatureResult {
  dissonance: number;
  hfc: number;
  spectralComplexity: number;
  zeroCrossingRate: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let essentiaInstance: any = null;

async function getEssentia() {
  if (essentiaInstance) return essentiaInstance;
  // Dynamic import to keep WASM out of the initial bundle
  const essentiaModule = await import('essentia.js');

  // Handle both ES module and CommonJS module structures
  const Essentia = essentiaModule.Essentia || essentiaModule.default;
  const EssentiaWASM = essentiaModule.EssentiaWASM;

  if (!Essentia || !EssentiaWASM) {
    throw new Error('Failed to load Essentia.js modules');
  }

  const wasmModule = await EssentiaWASM(); 
  essentiaInstance = new Essentia(wasmModule); 
  return essentiaInstance;
}

export async function extractEssentiaFeatures(
  audioBuffer: AudioBuffer
): Promise<EssentiaFeatureResult> {
  let essentia;
  try {
    essentia = await getEssentia();
  } catch (err) {
    console.warn('[Essentia] Failed to load, returning zero features:', err);
    return { dissonance: 0, hfc: 0, spectralComplexity: 0, zeroCrossingRate: 0 };
  }

  try {
    const channelData = audioBuffer.getChannelData(0);
    const frameSize = 2048;
    const hopSize = 1024;

    let dissonanceAcc = 0;
    let hfcAcc = 0;
    let complexityAcc = 0;
    let zcrAcc = 0;
    let frameCount = 0;

    for (let offset = 0; offset + frameSize <= channelData.length; offset += hopSize) {
      const frame = channelData.subarray(offset, offset + frameSize);
      const signal = essentia.arrayToVector(frame);

      // ZCR on raw frame
      zcrAcc += essentia.ZeroCrossingRate(signal).zeroCrossingRate;

      // Spectral features require windowing + spectrum
      // Windowing(frame, normalized?, size?, type?) — defaults to hann window
      const windowed = essentia.Windowing(signal, true, frameSize, 'hann').frame;
      const spectrum = essentia.Spectrum(windowed).spectrum;

      hfcAcc += essentia.HFC(spectrum).hfc;
      complexityAcc += essentia.SpectralComplexity(spectrum).spectralComplexity;

      // Dissonance needs peaks from spectrum
      const peaks = essentia.SpectralPeaks(spectrum);
      dissonanceAcc += essentia.Dissonance(peaks.frequencies, peaks.magnitudes).dissonance;

      frameCount++;
    }

    if (frameCount === 0) {
      return { dissonance: 0, hfc: 0, spectralComplexity: 0, zeroCrossingRate: 0 };
    }

    return {
      dissonance: dissonanceAcc / frameCount,
      hfc: hfcAcc / frameCount,
      spectralComplexity: complexityAcc / frameCount,
      zeroCrossingRate: zcrAcc / frameCount,
    };
  } catch (err) {
    console.warn('[Essentia] Feature extraction failed, returning zero features:', err);
    return { dissonance: 0, hfc: 0, spectralComplexity: 0, zeroCrossingRate: 0 };
  }
}
