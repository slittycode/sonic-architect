/**
 * Gemini Provider — V2 Two-Phase Architecture
 *
 * Phase 1 (audio + hints): Comprehensive structured audio analysis.
 *   Gemini receives the full audio via Files API + local DSP hints,
 *   returns GeminiPhase1Response validated by Zod.
 *
 * Phase 2 (audio + Phase 1 + hints): Refinement pass.
 *   Gemini listens again with the Phase 1 analysis in context,
 *   returns GeminiPhase2Additions (mix feedback, corrections, enrichments).
 *
 * Both phases include audio. Files API is used for all uploads.
 * Pipeline: parallel(upload, baseDSP) → Phase 1 → Phase 2 → assemble → cleanup.
 */

import { GoogleGenAI, FileState } from '@google/genai';
import type { Part } from '@google/genai';
import type {
  AnalysisProvider,
  ReconstructionBlueprint,
  GlobalTelemetry,
  LocalDSPHints,
  MixFeedback,
  SonicElement,
  DetectedCharacteristics,
  GenreAnalysis,
} from '../../types';
import { decodeAudioFile, extractAudioFeatures } from '../audioAnalysis';
import { extractEssentiaFeatures } from '../essentiaFeatures';
import { separateHarmonicPercussive, wrapAsAudioBuffer } from '../hpss';
import { detectChords } from '../chordDetection';
import { phase1Schema, type GeminiPhase1Response } from './schemas/phase1Schema';
import { phase2Schema, type GeminiPhase2Additions } from './schemas/phase2Schema';
import { buildPhase1Prompt } from './prompts/phase1Analysis';
import { buildPhase2Prompt } from './prompts/phase2Refinement';
import {
  startDiagnosticReport,
  addDiagnosticEntry,
  finishAndDownloadReport,
  isDiagEnabled,
} from './diagnosticLog';
import { extractJsonFromText } from './extractJson';

export type GeminiModelId =
  | 'gemini-2.0-flash'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-3-flash-preview'
  | 'gemini-3.1-flash-preview'
  | 'gemini-3.1-pro-preview';

export type GeminiModelGroup = 'experimental' | 'stable' | 'preview';

export const GEMINI_MODELS: { id: GeminiModelId; label: string; group: GeminiModelGroup }[] = [
  // Latest/Experimental
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', group: 'experimental' },
  // Stable Flash
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'stable' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', group: 'stable' },
  // Legacy/Preview
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)', group: 'preview' },
  { id: 'gemini-3.1-flash-preview', label: 'Gemini 3.1 Flash (Preview)', group: 'preview' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', group: 'preview' },
];

export const GEMINI_MODEL_LABELS: Record<GeminiModelId, string> = Object.fromEntries(
  GEMINI_MODELS.map((m) => [m.id, m.label])
) as Record<GeminiModelId, string>;

const DEFAULT_MODEL: GeminiModelId = 'gemini-2.5-flash';

/**
 * Preview models produce significantly shorter/shallower output when forced
 * into responseMimeType: 'application/json'. Let them respond in free-text
 * mode and extract JSON from the response instead.
 */
const MODELS_WITHOUT_JSON_MODE = new Set<GeminiModelId>([
  'gemini-3-flash-preview',
  'gemini-3.1-flash-preview',
  'gemini-3.1-pro-preview',
]);

// ---------------------------------------------------------------------------
// File reading helpers
// ---------------------------------------------------------------------------

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read audio file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload to Files API, poll until ACTIVE.
 * Returns { fileUri, fileName } for the uploaded file.
 */
async function uploadToFilesAPI(
  ai: GoogleGenAI,
  file: File
): Promise<{ fileUri: string; fileName: string }> {
  const uploaded = await ai.files.upload({ file, config: { mimeType: file.type } });
  if (!uploaded.uri || !uploaded.name) {
    throw new Error('Gemini file upload returned no URI or name');
  }

  let fileInfo = uploaded;
  while (fileInfo.state === FileState.PROCESSING) {
    await new Promise((r) => setTimeout(r, 2000));
    fileInfo = await ai.files.get({ name: uploaded.name });
  }
  if (fileInfo.state === FileState.FAILED) {
    throw new Error('Gemini file processing failed');
  }
  if (!fileInfo.uri) {
    throw new Error('Gemini file processing returned no URI');
  }

  return { fileUri: fileInfo.uri, fileName: uploaded.name };
}

/**
 * Build the audio Part — either fileData (from Files API URI) or inline base64.
 */
function buildAudioPartFromUri(fileUri: string, mimeType: string): Part {
  return { fileData: { fileUri, mimeType } };
}

function buildInlineAudioPart(base64: string, mimeType: string): Part {
  return { inlineData: { data: base64, mimeType } };
}

// ---------------------------------------------------------------------------
// Base DSP — extract LocalDSPHints from audio
// ---------------------------------------------------------------------------

async function runBaseDSP(audioBuffer: AudioBuffer): Promise<LocalDSPHints> {
  const features = extractAudioFeatures(audioBuffer);

  // Essentia.js WASM features (non-blocking on failure)
  const essentiaFeatures = await extractEssentiaFeatures(audioBuffer).catch((err) => {
    console.warn('[GeminiProvider] Essentia.js unavailable:', err);
    return null;
  });

  // HPSS for chord detection
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

// ---------------------------------------------------------------------------
// Zod validation with fallback
// ---------------------------------------------------------------------------

function parsePhase1Response(raw: string, hints: LocalDSPHints): GeminiPhase1Response {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Attempt truncated JSON repair — close open brackets/braces
    let repaired = cleaned;
    const opens = (repaired.match(/[{[]/g) || []).length;
    const closes = (repaired.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      repaired += repaired.lastIndexOf('[') > repaired.lastIndexOf('{') ? ']' : '}';
    }
    parsed = JSON.parse(repaired);
  }

  const result = phase1Schema.safeParse(parsed);
  if (result.success) return result.data;

  // Partial extraction — use Zod defaults/catches for individual fields
  console.warn('[GeminiProvider] Phase 1 Zod validation failed, using field-level fallbacks:', result.error.issues.slice(0, 5));

  // Force through with catches (schema has .catch() on every field)
  const forced = phase1Schema.parse(parsed ?? {});
  // Override BPM/key with local hints if Gemini returned garbage
  if (!forced.bpm || forced.bpm === 120) {
    forced.bpm = hints.bpm;
    forced.bpmConfidence = hints.bpmConfidence;
  }
  if (!forced.key || forced.key === 'C major') {
    forced.key = hints.key;
    forced.keyConfidence = hints.keyConfidence;
  }

  return forced;
}

function parsePhase2Response(raw: string): GeminiPhase2Additions {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    let repaired = cleaned;
    const opens = (repaired.match(/[{[]/g) || []).length;
    const closes = (repaired.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      repaired += repaired.lastIndexOf('[') > repaired.lastIndexOf('{') ? ']' : '}';
    }
    parsed = JSON.parse(repaired);
  }

  const result = phase2Schema.safeParse(parsed);
  if (result.success) return result.data;

  console.warn('[GeminiProvider] Phase 2 Zod validation failed, using field-level fallbacks:', result.error.issues.slice(0, 5));
  return phase2Schema.parse(parsed ?? {});
}

// ---------------------------------------------------------------------------
// Retry helper
// ---------------------------------------------------------------------------

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[GeminiProvider] ${label} failed, retrying once:`, err);
    return fn();
  }
}

// ---------------------------------------------------------------------------
// Genre family derivation
// ---------------------------------------------------------------------------

function deriveGenreFamily(
  genre: string
): GlobalTelemetry['genreFamily'] {
  const lower = genre.toLowerCase();
  if (lower.includes('house') || lower.includes('garage') || lower.includes('funky')) return 'house';
  if (lower.includes('techno') || lower.includes('industrial') || lower.includes('hardstyle'))
    return 'techno';
  if (
    lower.includes('drum and bass') ||
    lower.includes('dnb') ||
    lower.includes('jungle') ||
    lower.includes('neurofunk')
  )
    return 'dnb';
  if (lower.includes('ambient') || lower.includes('drone') || lower.includes('atmospheric'))
    return 'ambient';
  if (lower.includes('trance') || lower.includes('progressive') || lower.includes('psytrance'))
    return 'trance';
  if (lower.includes('dubstep') || lower.includes('brostep') || lower.includes('riddim'))
    return 'dubstep';
  if (lower.includes('breaks') || lower.includes('breakbeat') || lower.includes('nu skool'))
    return 'breaks';
  return 'other';
}

// ---------------------------------------------------------------------------
// Blueprint assembly
// ---------------------------------------------------------------------------

function assembleBlueprint(
  phase1: GeminiPhase1Response,
  phase2: GeminiPhase2Additions | null,
  hints: LocalDSPHints,
  features: { spectralTimeline?: { timePoints: number[]; bands: { name: string; energyDb: number[] }[] }; spectralBands: Array<{ name: string; rangeHz: [number, number]; averageDb: number; peakDb: number; dominance: string }>; mfcc?: number[] },
  analysisTime: number,
  _modelId: GeminiModelId,
): ReconstructionBlueprint {
  // Start with Phase 1 as the base
  let bpm = phase1.bpm;
  let key = phase1.key;

  // Apply Phase 2 corrections if confidence > 0.5
  if (phase2?.bpmCorrection?.correctedBpm && (phase2.bpmCorrection.confidence ?? 0) > 0.5) {
    bpm = phase2.bpmCorrection.correctedBpm;
  }
  if (phase2?.keyCorrection?.correctedKey && (phase2.keyCorrection.confidence ?? 0) > 0.5) {
    key = phase2.keyCorrection.correctedKey;
  }

  // Build telemetry
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

    // BPM/key correction flags
    ...(String(bpm) !== String(hints.bpm) && {
      bpmCorrectedByGemini: true,
      localBpmEstimate: String(hints.bpm),
    }),
    ...(key !== hints.key && {
      keyCorrectedByGemini: true,
      localKeyEstimate: hints.key,
    }),

    // V2 fields — type assertions are safe because Zod .catch() guarantees values
    elements: phase1.elements as SonicElement[],
    detectedCharacteristics: phase1.detectedCharacteristics as unknown as DetectedCharacteristics,
    genreAnalysis: phase1.genreAnalysis as unknown as GenreAnalysis,
    grooveDescription: phase1.grooveDescription,
    geminiChordProgression: phase1.chordProgression as { chords: { chord: string; startTime: number; duration: number }[]; summary: string },

    // Sidechain from Gemini detection
    ...(phase1.detectedCharacteristics.sidechain?.present && {
      sidechainAnalysis: {
        hasSidechain: true,
        strength: 0.7,
      },
    }),

    // Acid from Gemini detection
    ...(phase1.detectedCharacteristics.acidResonance?.present && {
      acidAnalysis: { isAcid: true, confidence: 0.7, resonanceLevel: 0.6 },
    }),

    // Reverb from Gemini detection
    ...(phase1.detectedCharacteristics.reverbCharacter?.present && {
      reverbAnalysis: { isWet: true, rt60: 0, tailEnergyRatio: 0 },
    }),

    // Verification notes
    verificationNotes: buildVerificationNotes(hints, bpm, key),
  };

  // Instrumentation → InstrumentRackElement[]
  // Prefer Phase 2 (actionable device chains) over Phase 1 (basic identification)
  const phase2Inst = phase2?.instrumentation ?? [];
  const sourceInstrumentation =
    phase2Inst.length > 0 ? phase2Inst : phase1.instrumentation;

  const instrumentation = sourceInstrumentation.map((inst) => {
    // Phase 2 has deviceChain (string) with full signal chain + parameters
    const deviceChainStr = 'deviceChain' in inst ? (inst.deviceChain as string) : '';
    const paramNotes = 'parameterNotes' in inst ? (inst.parameterNotes as string) : '';
    const presetHint = 'presetSuggestion' in inst ? (inst.presetSuggestion as string) : '';

    // Build a rich timbre description
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

  // Effects → FXChainItem[]
  // Prefer Phase 2 (precise settings) over Phase 1 (basic identification)
  const phase2Fx = phase2?.effectsChain ?? [];
  const sourceEffects = phase2Fx.length > 0 ? phase2Fx : phase1.effectsChain;

  const fxChain = sourceEffects.map((fx) => ({
    artifact: fx.name,
    recommendation: `${fx.abletonDevice}: ${fx.settings} — ${fx.purpose}`,
  }));

  // Arrangement → ArrangementSection[]
  const arrangement = phase1.arrangement.map((s) => ({
    timeRange: `${formatTime(s.startTime)}–${formatTime(s.endTime)}`,
    label: s.section.charAt(0).toUpperCase() + s.section.slice(1),
    description: s.description,
  }));

  // Secret Sauce — prefer Phase 2 (detailed recreation) over Phase 1 (basic identification)
  const phase2Sauce = phase2?.secretSauce;
  const sauceSource =
    phase2Sauce && phase2Sauce.technique !== 'Not detected'
      ? phase2Sauce
      : phase1.secretSauce;

  const secretSauce = {
    trick: sauceSource.technique,
    execution: `${sauceSource.description}\n\n${sauceSource.abletonImplementation}`,
  };

  // Chord progression from Phase 1
  const chordProgression = phase1.chordProgression.chords.map((c) => ({
    timeRange: `${formatTime(c.startTime)}–${formatTime(c.startTime + c.duration)}`,
    chord: c.chord,
    root: c.chord.replace(/[^A-Ga-g#b].*/, ''),
    quality: c.chord.replace(/^[A-Ga-g#b]+/, '') || 'major',
    confidence: 0.8, // Gemini doesn't return per-chord confidence
  }));

  // Mix feedback from Phase 2
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

function buildVerificationNotes(hints: LocalDSPHints, bpm: number, key: string): string {
  const parts: string[] = [];
  if (String(bpm) !== String(hints.bpm)) {
    parts.push(`⚠ BPM: local ${hints.bpm}, Gemini hears ~${bpm}`);
  } else {
    parts.push(`✓ BPM ${bpm} confirmed`);
  }
  if (key !== hints.key) {
    parts.push(`⚠ Key: local ${hints.key}, Gemini hears ${key}`);
  } else {
    parts.push(`✓ Key ${key} confirmed`);
  }
  return parts.join(' · ');
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Chat service
// ---------------------------------------------------------------------------

const CHAT_SYSTEM_PROMPT =
  'You are an Ableton Live 12 production expert helping a music producer understand and ' +
  'recreate a track. Give specific, actionable advice using Ableton-native devices and ' +
  'techniques. Reference the blueprint data when relevant. Be concise but precise.';

/**
 * Gemini chat service — streams replies directly from the browser.
 * No server proxy needed; uses the same VITE_GEMINI_API_KEY already in the bundle.
 */
export class GeminiChatService {
  private history: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

  constructor(
    private readonly getBlueprint: (() => ReconstructionBlueprint | null) | null = null
  ) {}

  async sendMessage(text: string): Promise<ReadableStream<string>> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Gemini API key not configured. Set GEMINI_API_KEY in .env.local to use the chat assistant.'
      );
    }

    const trimmed = text.trim();
    if (!trimmed) throw new Error('Message text cannot be empty.');

    const blueprint = this.getBlueprint?.();
    const systemInstruction = blueprint
      ? `${CHAT_SYSTEM_PROMPT}\n\nBlueprint context:\n${JSON.stringify(blueprint, null, 2)}`
      : CHAT_SYSTEM_PROMPT;

    this.history.push({ role: 'user', parts: [{ text: trimmed }] });
    const historySnapshot = [...this.history];
    const historyRef = this.history;
    let fullResponse = '';

    const ai = new GoogleGenAI({ apiKey });
    const responseStream = await ai.models.generateContentStream({
      model: `models/${DEFAULT_MODEL}`,
      contents: historySnapshot,
      config: { systemInstruction },
    });

    return new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of responseStream) {
            const chunkText = chunk.text ?? '';
            if (chunkText) {
              fullResponse += chunkText;
              controller.enqueue(chunkText);
            }
          }
          historyRef.push({ role: 'model', parts: [{ text: fullResponse }] });
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  clearHistory(): void {
    this.history = [];
  }
}

// ---------------------------------------------------------------------------
// Main provider
// ---------------------------------------------------------------------------

export class GeminiProvider implements AnalysisProvider {
  type = 'gemini' as const;
  private modelId: GeminiModelId;

  constructor(model: GeminiModelId = DEFAULT_MODEL) {
    this.modelId = model;
  }

  get name(): string {
    return `${GEMINI_MODEL_LABELS[this.modelId]} (Cloud + Local DSP)`;
  }

  async isAvailable(): Promise<boolean> {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    return typeof key === 'string' && key.length > 0;
  }

  async analyze(
    file: File,
    signal?: AbortSignal,
    onProgress?: (message: string) => void
  ): Promise<ReconstructionBlueprint> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing API key. Set GEMINI_API_KEY in .env.local to use the Gemini provider.'
      );
    }

    signal?.throwIfAborted();

    const startTime = performance.now();
    const ai = new GoogleGenAI({ apiKey });
    const modelPath = `models/${this.modelId}`;

    // Diagnostic logging (enable: localStorage.setItem('GEMINI_DIAG', '1'))
    startDiagnosticReport(this.modelId, modelPath, file.name, file.size);

    // Step 1 — PARALLEL: Files API upload + Base DSP
    onProgress?.('Uploading audio...');
    const audioBuffer = await decodeAudioFile(file);
    signal?.throwIfAborted();
    onProgress?.('Decoding audio...');

    let fileUri: string | null = null;
    let fileName: string | null = null;
    let base64Fallback: string | null = null;
    let hints: LocalDSPHints;

    try {
      const [uploadResult, dspResult] = await Promise.all([
        uploadToFilesAPI(ai, file),
        runBaseDSP(audioBuffer),
      ]);
      signal?.throwIfAborted();
      fileUri = uploadResult.fileUri;
      fileName = uploadResult.fileName;
      hints = dspResult;
    } catch (err) {
      signal?.throwIfAborted();
      // If upload fails, fall back to inline base64 for Phase 1
      console.warn('[GeminiProvider] Files API upload failed, using inline base64:', err);
      base64Fallback = await readFileAsBase64(file);
      hints = await runBaseDSP(audioBuffer);
    }

    const features = extractAudioFeatures(audioBuffer);

    // Build the audio part for Gemini calls
    const audioPart: Part = fileUri
      ? buildAudioPartFromUri(fileUri, file.type)
      : buildInlineAudioPart(base64Fallback!, file.type);

    // Step 2 — Phase 1: Audio + Hints → GeminiPhase1Response
    signal?.throwIfAborted();
    onProgress?.('Analyzing with Gemini (Phase 1)...');
    const useJsonMode = !MODELS_WITHOUT_JSON_MODE.has(this.modelId);
    let phase1: GeminiPhase1Response;
    try {
      phase1 = await withRetry(async () => {
        signal?.throwIfAborted();
        const basePrompt = buildPhase1Prompt(hints);
        const phase1Prompt = useJsonMode
          ? basePrompt
          : basePrompt +
            '\n\nRespond with ONLY a single JSON object. Do not include any markdown formatting, commentary, or text outside the JSON.';
        const phase1Start = performance.now();

        const response = await ai.models.generateContent({
          model: modelPath,
          contents: [
            {
              parts: [
                audioPart,
                { text: phase1Prompt },
              ],
            },
          ],
          config: useJsonMode
            ? { responseMimeType: 'application/json' }
            : undefined,
        });

        let rawText = response.text ?? '{}';
        if (!useJsonMode) {
          rawText = extractJsonFromText(rawText);
        }

        // Diagnostic capture
        if (isDiagEnabled()) {
          addDiagnosticEntry({
            phase: 'phase1',
            model: this.modelId,
            modelPath,
            audioPartType: fileUri ? 'fileData' : 'inlineData',
            audioMimeType: file.type,
            fileUri: fileUri ?? undefined,
            promptLength: phase1Prompt.length,
            promptPreview: phase1Prompt.slice(0, 500),
            configSent: useJsonMode
              ? { responseMimeType: 'application/json' }
              : { responseMimeType: 'none (free-text)' },
            responseLength: rawText.length,
            responseFirst500: rawText.slice(0, 500),
            responseLast200: rawText.slice(-200),
            responseFullText: rawText,
            durationMs: Math.round(performance.now() - phase1Start),
          });
        }

        return parsePhase1Response(rawText, hints);
      }, 'Phase 1');
    } catch (err) {
      // Phase 1 failed after retry → fall back to full Local mode
      console.warn('[GeminiProvider] Phase 1 failed, falling back to Local mode:', err);
      const { LocalAnalysisProvider } = await import('../localProvider');
      const localProvider = new LocalAnalysisProvider();
      const localBlueprint = await localProvider.analyzeAudioBuffer(audioBuffer);
      const analysisTime = Math.round(performance.now() - startTime);

      // Clean up uploaded file (fire-and-forget)
      if (fileName) {
        ai.files.delete({ name: fileName }).catch(() => {});
      }

      return {
        ...localBlueprint,
        telemetry: {
          ...localBlueprint.telemetry,
          verificationNotes:
            'Gemini Phase 1 failed — fell back to full Local DSP analysis.',
        },
        meta: {
          provider: 'gemini',
          analysisTime,
          sampleRate: features.sampleRate,
          duration: features.duration,
          channels: features.channels,
          llmEnhanced: false,
        },
      };
    }

    // Step 3 — Phase 2: Audio + Phase 1 + Hints → GeminiPhase2Additions
    signal?.throwIfAborted();
    onProgress?.('Refining analysis (Phase 2)...');
    let phase2: GeminiPhase2Additions | null = null;
    try {
      phase2 = await withRetry(async () => {
        signal?.throwIfAborted();
        const baseP2 = buildPhase2Prompt(phase1, hints);
        const phase2Prompt = useJsonMode
          ? baseP2
          : baseP2 +
            '\n\nRespond with ONLY a single JSON object. Do not include any markdown formatting, commentary, or text outside the JSON.';
        const phase2Start = performance.now();

        const response = await ai.models.generateContent({
          model: modelPath,
          contents: [
            {
              parts: [
                audioPart,
                { text: phase2Prompt },
              ],
            },
          ],
          config: useJsonMode
            ? { responseMimeType: 'application/json' }
            : undefined,
        });

        let rawText = response.text ?? '{}';
        if (!useJsonMode) {
          rawText = extractJsonFromText(rawText);
        }

        // Diagnostic capture
        if (isDiagEnabled()) {
          addDiagnosticEntry({
            phase: 'phase2',
            model: this.modelId,
            modelPath,
            audioPartType: fileUri ? 'fileData' : 'inlineData',
            audioMimeType: file.type,
            fileUri: fileUri ?? undefined,
            promptLength: phase2Prompt.length,
            promptPreview: phase2Prompt.slice(0, 500),
            configSent: useJsonMode
              ? { responseMimeType: 'application/json' }
              : { responseMimeType: 'none (free-text)' },
            responseLength: rawText.length,
            responseFirst500: rawText.slice(0, 500),
            responseLast200: rawText.slice(-200),
            responseFullText: rawText,
            durationMs: Math.round(performance.now() - phase2Start),
          });
        }

        return parsePhase2Response(rawText);
      }, 'Phase 2');
    } catch (err) {
      // Phase 2 failed — use Phase 1 results only (still good)
      console.warn('[GeminiProvider] Phase 2 failed, using Phase 1 results only:', err);
    }

    // Step 4 — Assemble blueprint
    onProgress?.('Building blueprint...');
    const analysisTime = Math.round(performance.now() - startTime);
    const blueprint = assembleBlueprint(phase1, phase2, hints, features, analysisTime, this.modelId);

    // Diagnostic: download comparison file
    finishAndDownloadReport(analysisTime);

    // Step 5 — Clean up uploaded file (fire-and-forget)
    if (fileName) {
      ai.files.delete({ name: fileName }).catch((err) => {
        console.warn('[GeminiProvider] Failed to delete uploaded file:', err);
      });
    }

    return blueprint;
  }
}
