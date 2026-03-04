import type {
  ReconstructionBlueprint,
  GlobalTelemetry,
  LocalDSPHints,
  MixFeedback,
  SonicElement,
  DetectedCharacteristics,
  GenreAnalysis,
  AudioFeatures,
} from '../../../types';
import type { GeminiModelId } from './client';
import type { GeminiPhase1Response } from '../../gemini/schemas/phase1Schema';
import type { GeminiPhase2Additions } from '../../gemini/schemas/phase2Schema';

function deriveGenreFamily(genre: string): GlobalTelemetry['genreFamily'] {
  const lower = genre.toLowerCase();
  if (lower.includes('house') || lower.includes('garage') || lower.includes('funky'))
    return 'house';
  if (lower.includes('techno') || lower.includes('industrial') || lower.includes('hardstyle'))
    return 'techno';
  if (
    lower.includes('drum and bass') ||
    lower.includes('dnb') ||
    lower.includes('jungle') ||
    lower.includes('neurofunk')
  ) {
    return 'dnb';
  }
  if (lower.includes('ambient') || lower.includes('drone') || lower.includes('atmospheric')) {
    return 'ambient';
  }
  if (lower.includes('trance') || lower.includes('progressive') || lower.includes('psytrance')) {
    return 'trance';
  }
  if (lower.includes('dubstep') || lower.includes('brostep') || lower.includes('riddim')) {
    return 'dubstep';
  }
  if (lower.includes('breaks') || lower.includes('breakbeat') || lower.includes('nu skool')) {
    return 'breaks';
  }
  return 'other';
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function buildVerificationNotes(hints: LocalDSPHints, bpm: number, key: string): string {
  const parts: string[] = [];
  if (String(bpm) !== String(hints.bpm)) {
    parts.push(`BPM mismatch: local ${hints.bpm}, Gemini ${bpm}`);
  } else {
    parts.push(`BPM ${bpm} confirmed`);
  }
  if (key !== hints.key) {
    parts.push(`Key mismatch: local ${hints.key}, Gemini ${key}`);
  } else {
    parts.push(`Key ${key} confirmed`);
  }
  return parts.join(' | ');
}

export function assembleBlueprint(
  phase1: GeminiPhase1Response,
  phase2: GeminiPhase2Additions | null,
  hints: LocalDSPHints,
  features: AudioFeatures,
  analysisTime: number,
  _modelId: GeminiModelId
): ReconstructionBlueprint {
  let bpm = phase1.bpm;
  let key = phase1.key;

  if (phase2?.bpmCorrection?.correctedBpm && (phase2.bpmCorrection.confidence ?? 0) > 0.5) {
    bpm = phase2.bpmCorrection.correctedBpm;
  }
  if (phase2?.keyCorrection?.correctedKey && (phase2.keyCorrection.confidence ?? 0) > 0.5) {
    key = phase2.keyCorrection.correctedKey;
  }

  const telemetry: GlobalTelemetry = {
    bpm: String(bpm),
    key,
    groove: phase1.grooveDescription || phase1.groove || '',
    bpmConfidence: phase1.bpmConfidence,
    keyConfidence: phase1.keyConfidence,
    detectedGenre: phase1.genre,
    enhancedGenre: phase1.genre,
    secondaryGenre: phase1.subGenre || undefined,
    genreFamily: deriveGenreFamily(phase1.genre),
    ...(String(bpm) !== String(hints.bpm) && {
      bpmCorrectedByGemini: true,
      localBpmEstimate: String(hints.bpm),
    }),
    ...(key !== hints.key && {
      keyCorrectedByGemini: true,
      localKeyEstimate: hints.key,
    }),
    elements: phase1.elements as SonicElement[],
    detectedCharacteristics: phase1.detectedCharacteristics as unknown as DetectedCharacteristics,
    genreAnalysis: phase1.genreAnalysis as unknown as GenreAnalysis,
    grooveDescription: phase1.grooveDescription,
    geminiChordProgression: phase1.chordProgression as {
      chords: { chord: string; startTime: number; duration: number }[];
      summary: string;
    },
    ...(phase1.detectedCharacteristics.sidechain?.present && {
      sidechainAnalysis: {
        hasSidechain: true,
        strength: 0.7,
      },
    }),
    ...(phase1.detectedCharacteristics.acidResonance?.present && {
      acidAnalysis: { isAcid: true, confidence: 0.7, resonanceLevel: 0.6 },
    }),
    ...(phase1.detectedCharacteristics.reverbCharacter?.present && {
      reverbAnalysis: { isWet: true, rt60: 0, tailEnergyRatio: 0 },
    }),
    verificationNotes: buildVerificationNotes(hints, bpm, key),
  };

  const phase2Inst = phase2?.instrumentation ?? [];
  const sourceInstrumentation = phase2Inst.length > 0 ? phase2Inst : phase1.instrumentation;

  const instrumentation = sourceInstrumentation.map((inst) => {
    const deviceChainStr = 'deviceChain' in inst ? (inst.deviceChain as string) : '';
    const paramNotes = 'parameterNotes' in inst ? (inst.parameterNotes as string) : '';
    const presetHint = 'presetSuggestion' in inst ? (inst.presetSuggestion as string) : '';
    const timbreParts = [inst.description];
    if (paramNotes) timbreParts.push(`\nParameters: ${paramNotes}`);
    if (presetHint && presetHint !== 'Init') timbreParts.push(`\nPreset: ${presetHint}`);

    return {
      element: inst.name,
      timbre: timbreParts.join(''),
      frequency: '',
      abletonDevice: deviceChainStr || inst.abletonDevice,
    };
  });

  const phase2Fx = phase2?.effectsChain ?? [];
  const sourceEffects = phase2Fx.length > 0 ? phase2Fx : phase1.effectsChain;

  const fxChain = sourceEffects.map((fx) => ({
    artifact: fx.name,
    recommendation: `${fx.abletonDevice}: ${fx.settings} - ${fx.purpose}`,
  }));

  const arrangement = phase1.arrangement.map((s) => ({
    timeRange: `${formatTime(s.startTime)}–${formatTime(s.endTime)}`,
    label: s.section.charAt(0).toUpperCase() + s.section.slice(1),
    description: s.description,
  }));

  const phase2Sauce = phase2?.secretSauce;
  const sauceSource =
    phase2Sauce && phase2Sauce.technique !== 'Not detected' ? phase2Sauce : phase1.secretSauce;

  const secretSauce = {
    trick: sauceSource.technique,
    execution: `${sauceSource.description}\n\n${sauceSource.abletonImplementation}`,
  };

  const chordProgression = phase1.chordProgression.chords.map((c) => ({
    timeRange: `${formatTime(c.startTime)}–${formatTime(c.startTime + c.duration)}`,
    chord: c.chord,
    root: c.chord.replace(/[^A-Ga-g#b].*/, ''),
    quality: c.chord.replace(/^[A-Ga-g#b]+/, '') || 'major',
    confidence: 0.8,
  }));

  let mixFeedback: MixFeedback | undefined;
  if (phase2?.mixFeedback) {
    mixFeedback = {
      overallAssessment: phase2.mixFeedback.overallBalance,
      spectralBalance: `Low: ${phase2.mixFeedback.lowEnd}\nMid: ${phase2.mixFeedback.midRange}\nHigh: ${phase2.mixFeedback.highEnd}`,
      stereoField: phase2.mixFeedback.stereoImage,
      dynamics: phase2.mixFeedback.dynamics,
      lowEnd: phase2.mixFeedback.lowEnd,
      highEnd: phase2.mixFeedback.highEnd,
      suggestions: phase2.mixFeedback.recommendations,
    };
  }

  return {
    telemetry,
    arrangement,
    instrumentation,
    fxChain:
      fxChain.length > 0
        ? fxChain
        : [
            {
              artifact: 'Balanced mix',
              recommendation:
                'No specific effects detected. Consider: EQ Eight (gentle cuts), Glue Compressor (2:1), Limiter (-0.3dB ceiling).',
            },
          ],
    secretSauce,
    chordProgression: chordProgression.length > 0 ? chordProgression : undefined,
    chordProgressionSummary: phase1.chordProgression.summary || undefined,
    mfcc: features.mfcc,
    spectralTimeline: features.spectralTimeline,
    mixFeedback,
    geminiPhase1: phase1,
    geminiPhase2: phase2 ?? undefined,
    meta: {
      provider: 'gemini',
      analysisTime,
      sampleRate: hints.sampleRate,
      duration: hints.duration,
      channels: hints.channelCount,
      llmEnhanced: true,
    },
  };
}
