import type { LocalDSPHints } from '../../../types';
import { detectChords } from '../../chordDetection';
import { extractAudioFeatures } from '../../audioAnalysis';
import { extractEssentiaFeatures } from '../../essentiaFeatures';
import { separateHarmonicPercussive, wrapAsAudioBuffer } from '../../hpss';

export async function runBaseDSP(audioBuffer: AudioBuffer): Promise<LocalDSPHints> {
  const features = extractAudioFeatures(audioBuffer);

  const essentiaFeatures = await extractEssentiaFeatures(audioBuffer).catch((err) => {
    console.warn('[GeminiProvider] Essentia.js unavailable:', err);
    return null;
  });

  const hpss = separateHarmonicPercussive(audioBuffer);
  const harmonicBuffer = wrapAsAudioBuffer(hpss.harmonic, hpss.sampleRate);
  const chordResult = detectChords(harmonicBuffer);

  return {
    bpm: features.bpm,
    bpmConfidence: features.bpmConfidence,
    key: `${features.key.root} ${features.key.scale}`,
    keyConfidence: features.key.confidence,
    spectralBands: features.spectralBands,
    spectralTimeline: features.spectralTimeline ?? { timePoints: [], bands: [] },
    rmsEnvelope: features.rmsProfile,
    onsets: Array.from({ length: features.onsetCount }, (_, i) => i),
    mfcc: features.mfcc ? [features.mfcc] : [],
    chordProgression: chordResult.chords,
    ...(essentiaFeatures && {
      essentiaFeatures: {
        dissonance: essentiaFeatures.dissonance,
        hfc: essentiaFeatures.hfc,
        spectralComplexity: essentiaFeatures.spectralComplexity,
        zeroCrossingRate: essentiaFeatures.zeroCrossingRate,
      },
    }),
    lufsIntegrated: features.lufsIntegrated,
    truePeak: features.truePeak,
    stereoCorrelation: features.stereoCorrelation,
    stereoWidth: features.stereoWidth,
    monoCompatible: features.monoCompatible,
    duration: features.duration,
    sampleRate: features.sampleRate,
    channelCount: features.channels,
  };
}

export async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[GeminiProvider] ${label} failed, retrying once:`, err);
    return fn();
  }
}
