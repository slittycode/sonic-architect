/**
 * Gemini Provider — Sequential 2-Phase Architecture
 *
 * Phase 1 (with audio): Comprehensive structured audio analysis via
 * AudioAnalysisResult. Feeds all 8 telemetry detector fields.
 *
 * Phase 2 (text-only, no audio): Ableton device chain generation using
 * Phase 1 results + local DSP telemetry. Reuses parseGeminiEnhancement /
 * mergeGeminiEnhancement unchanged from the original implementation.
 *
 * Only ONE generateContent call includes inlineData (audio).
 */

import { GoogleGenAI } from '@google/genai';
import { AnalysisProvider, ReconstructionBlueprint, GlobalTelemetry } from '../../types';
import { decodeAudioFile, extractAudioFeatures } from '../audioAnalysis';
import { generateMixReport } from '../mixDoctor';
import { AudioAnalysisResult, validateAudioAnalysisResult } from './types/analysis';
import { buildAudioAnalysisPrompt } from './prompts/audioAnalysis';
import { buildDeviceChainsPrompt } from './prompts/deviceChains';

export type GeminiModelId = 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro';

export const GEMINI_MODEL_LABELS: Record<GeminiModelId, string> = {
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
};

const DEFAULT_MODEL: GeminiModelId = 'gemini-2.5-flash';
/** Gemini inline audio upload hard cap (20 MB). Files above this skip cloud enrichment. */
const GEMINI_INLINE_LIMIT = 20 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Enhancement merge helpers (reused from original geminiService)
// ---------------------------------------------------------------------------

// Enhancement shape — matches Ollama/Claude pattern exactly
interface GeminiEnhancement {
  groove?: string;
  instrumentation?: Array<{
    element: string;
    timbre?: string;
    abletonDevice?: string;
  }>;
  fxChain?: Array<{
    artifact: string;
    recommendation?: string;
  }>;
  secretSauce?: {
    trick?: string;
    execution?: string;
  };
}

export function parseGeminiEnhancement(raw: string): GeminiEnhancement | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(trimmed) as GeminiEnhancement;
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

export function mergeGeminiEnhancement(
  blueprint: ReconstructionBlueprint,
  enhancement: GeminiEnhancement | null
): ReconstructionBlueprint {
  if (!enhancement) return blueprint;

  const merged: ReconstructionBlueprint = {
    ...blueprint,
    telemetry: { ...blueprint.telemetry },
    instrumentation: blueprint.instrumentation.map((item) => ({ ...item })),
    fxChain: blueprint.fxChain.map((item) => ({ ...item })),
    secretSauce: { ...blueprint.secretSauce },
    meta: blueprint.meta ? { ...blueprint.meta } : undefined,
  };

  if (enhancement.groove && typeof enhancement.groove === 'string') {
    merged.telemetry.groove = enhancement.groove;
  }
  if (Array.isArray(enhancement.instrumentation)) {
    for (const update of enhancement.instrumentation) {
      if (!update?.element) continue;
      const idx = merged.instrumentation.findIndex((i) => i.element === update.element);
      if (idx === -1) continue;
      if (typeof update.timbre === 'string' && update.timbre.trim())
        merged.instrumentation[idx].timbre = update.timbre.trim();
      if (typeof update.abletonDevice === 'string' && update.abletonDevice.trim())
        merged.instrumentation[idx].abletonDevice = update.abletonDevice.trim();
    }
  }
  if (Array.isArray(enhancement.fxChain)) {
    for (const update of enhancement.fxChain) {
      if (!update?.artifact) continue;
      const idx = merged.fxChain.findIndex((f) => f.artifact === update.artifact);
      if (idx === -1) continue;
      if (typeof update.recommendation === 'string' && update.recommendation.trim())
        merged.fxChain[idx].recommendation = update.recommendation.trim();
    }
  }
  if (enhancement.secretSauce) {
    if (typeof enhancement.secretSauce.trick === 'string' && enhancement.secretSauce.trick.trim())
      merged.secretSauce.trick = enhancement.secretSauce.trick.trim();
    if (
      typeof enhancement.secretSauce.execution === 'string' &&
      enhancement.secretSauce.execution.trim()
    )
      merged.secretSauce.execution = enhancement.secretSauce.execution.trim();
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Audio analysis merge — Phase 1 results into blueprint telemetry
// Conflict resolution: prefer Gemini when it conflicts with local DSP
// ---------------------------------------------------------------------------

/**
 * Derive a genreFamily slug from an open-ended genre string.
 * Maps common genre keywords to the 8 supported families.
 */
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

/**
 * Merge AudioAnalysisResult into blueprint telemetry.
 * Gemini's values take precedence over local DSP when they conflict,
 * with correction flags set for BPM/key changes.
 */
export function mergeAudioAnalysis(
  blueprint: ReconstructionBlueprint,
  analysis: AudioAnalysisResult | null
): ReconstructionBlueprint {
  if (!analysis) return blueprint;

  const t = { ...blueprint.telemetry };

  // BPM — update with correction flag if changed
  const gemBpm = String(analysis.bpm.value);
  if (gemBpm !== t.bpm) {
    t.localBpmEstimate = t.bpm;
    t.bpm = gemBpm;
    t.bpmCorrectedByGemini = true;
  }

  // Key — combine root + scale, update with correction flag if changed
  const gemKey = `${analysis.key.root} ${analysis.key.scale}`;
  if (gemKey !== t.key) {
    t.localKeyEstimate = t.key;
    t.key = gemKey;
    t.keyCorrectedByGemini = true;
  }

  // Genre classification
  if (analysis.genreAffinity.length > 0) {
    const primary = analysis.genreAffinity[0].genre;
    t.enhancedGenre = primary;
    t.detectedGenre = primary;
    t.genreFamily = deriveGenreFamily(primary);
    if (analysis.genreAffinity.length > 1) {
      t.secondaryGenre = analysis.genreAffinity[1].genre;
    }
  }

  // Presence flags — augment detector telemetry with Gemini's audio perception
  if (analysis.presenceOf.sidechain) {
    t.sidechainAnalysis = {
      hasSidechain: true,
      strength: t.sidechainAnalysis?.strength ?? 0.7,
    };
  } else if (t.sidechainAnalysis) {
    // Gemini says no sidechain — override local DSP detection
    t.sidechainAnalysis = { ...t.sidechainAnalysis, hasSidechain: false };
  }

  if (analysis.presenceOf.acidResonance && t.acidAnalysis) {
    t.acidAnalysis = { ...t.acidAnalysis, isAcid: true };
  } else if (!analysis.presenceOf.acidResonance && t.acidAnalysis) {
    t.acidAnalysis = { ...t.acidAnalysis, isAcid: false };
  }

  if (analysis.presenceOf.distortion && t.kickAnalysis) {
    t.kickAnalysis = { ...t.kickAnalysis, isDistorted: true };
  }

  if (analysis.presenceOf.reverb && t.reverbAnalysis) {
    t.reverbAnalysis = { ...t.reverbAnalysis, isWet: true };
  }

  // Groove pattern — supplement swingAnalysis if absent
  if (!t.swingAnalysis && analysis.bpm.groovePattern !== 'straight') {
    const grooveTypeMap: Record<string, GlobalTelemetry['swingAnalysis'] & object> = {
      swing: { swingPercent: 15, grooveType: 'slight-swing' },
      shuffle: { swingPercent: 30, grooveType: 'shuffle' },
      broken: { swingPercent: 10, grooveType: 'slight-swing' },
    };
    const mapped = grooveTypeMap[analysis.bpm.groovePattern];
    if (mapped) t.swingAnalysis = mapped;
  }

  // Build verification notes from BPM/key agreement
  const parts: string[] = [];
  if (t.bpmCorrectedByGemini) {
    parts.push(`⚠ BPM: local ${t.localBpmEstimate}, Gemini hears ~${t.bpm}`);
  } else {
    parts.push(`✓ BPM ${t.bpm} confirmed`);
  }
  if (t.keyCorrectedByGemini) {
    parts.push(`⚠ Key: local ${t.localKeyEstimate}, Gemini hears ${t.key}`);
  } else {
    parts.push(`✓ Key ${t.key} confirmed`);
  }
  if (analysis.productionNotes) {
    parts.push(`— ${analysis.productionNotes}`);
  }
  t.verificationNotes = parts.join(' · ');

  // Store full analysis object for downstream consumers
  t.geminiAudioAnalysis = analysis;

  return { ...blueprint, telemetry: t };
}

// ---------------------------------------------------------------------------
// Chat service (reused from original geminiService)
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

  async analyze(file: File): Promise<ReconstructionBlueprint> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing API key. Set GEMINI_API_KEY in .env.local to use the Gemini provider.'
      );
    }

    const startTime = performance.now();

    // Step 1 — Local DSP: precise BPM, key, spectrum, chords, 8 detectors
    const audioBuffer = await decodeAudioFile(file);
    const { LocalAnalysisProvider } = await import('../localProvider');
    const localProvider = new LocalAnalysisProvider();
    const localBlueprint = await localProvider.analyzeAudioBuffer(audioBuffer);

    // Step 2 — Enforce 20 MB inline limit (Gemini API hard cap)
    if (file.size > GEMINI_INLINE_LIMIT) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      const analysisTime = Math.round(performance.now() - startTime);
      return {
        ...localBlueprint,
        telemetry: {
          ...localBlueprint.telemetry,
          verificationNotes: `File is ${mb}MB — exceeds Gemini 20MB inline limit. Local DSP measurements used without cloud enrichment.`,
        },
        meta: {
          provider: 'gemini',
          analysisTime,
          sampleRate: localBlueprint.meta?.sampleRate ?? 0,
          duration: localBlueprint.meta?.duration ?? 0,
          channels: localBlueprint.meta?.channels ?? 0,
        },
      };
    }

    // Step 3 — Read file as base64 for Gemini audio input
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('Failed to read audio file.'));
      reader.readAsDataURL(file);
    });

    const ai = new GoogleGenAI({ apiKey });
    const audioPart = { inlineData: { data: base64, mimeType: file.type } };
    const modelPath = `models/${this.modelId}`;

    // -----------------------------------------------------------------------
    // Phase 1 — Audio analysis (WITH audio file)
    // Single audio upload: comprehensive structured analysis
    // -----------------------------------------------------------------------
    let analysis: AudioAnalysisResult | null = null;
    try {
      const phase1Response = await ai.models.generateContent({
        model: modelPath,
        contents: [
          {
            parts: [
              audioPart,
              {
                text: buildAudioAnalysisPrompt(
                  localBlueprint.telemetry.bpm,
                  localBlueprint.telemetry.key,
                  localBlueprint.chordProgressionSummary
                ),
              },
            ],
          },
        ],
        config: { responseMimeType: 'application/json' },
      });

      const phase1Text = phase1Response.text ?? '{}';
      const cleaned = phase1Text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      analysis = validateAudioAnalysisResult(JSON.parse(cleaned));
    } catch (err) {
      console.warn('[GeminiProvider] Phase 1 audio analysis failed:', err);
    }

    // Merge Phase 1 analysis into blueprint (telemetry + genre + presence flags)
    const phase1Blueprint = mergeAudioAnalysis(localBlueprint, analysis);

    // Re-score Mix Doctor with Gemini-detected genre (if available)
    let mixReport = phase1Blueprint.mixReport;
    if (analysis?.genreAffinity?.[0]) {
      const features = extractAudioFeatures(audioBuffer);
      mixReport = generateMixReport(features, analysis.genreAffinity[0].genre);
    }

    // -----------------------------------------------------------------------
    // Phase 2 — Device chain generation (TEXT ONLY — no audio)
    // Uses Phase 1 analysis + local DSP telemetry as rich context
    // -----------------------------------------------------------------------
    const phase2Blueprint: ReconstructionBlueprint = { ...phase1Blueprint, mixReport };
    let finalBlueprint: ReconstructionBlueprint = phase2Blueprint;

    try {
      const phase2Response = await ai.models.generateContent({
        model: modelPath,
        contents: [
          {
            parts: [
              {
                text: buildDeviceChainsPrompt(phase2Blueprint, analysis),
              },
            ],
          },
        ],
        config: { responseMimeType: 'application/json' },
      });

      const enhancement = parseGeminiEnhancement(phase2Response.text ?? '');
      finalBlueprint = mergeGeminiEnhancement(phase2Blueprint, enhancement);
    } catch (err) {
      console.warn('[GeminiProvider] Phase 2 device chain generation failed:', err);
    }

    const analysisTime = Math.round(performance.now() - startTime);

    return {
      ...finalBlueprint,
      meta: {
        provider: 'gemini',
        analysisTime,
        sampleRate: localBlueprint.meta?.sampleRate ?? 0,
        duration: localBlueprint.meta?.duration ?? 0,
        channels: localBlueprint.meta?.channels ?? 0,
      },
    };
  }
}
