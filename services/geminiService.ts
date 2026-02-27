import { GoogleGenAI } from '@google/genai';
import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { decodeAudioFile } from './audioAnalysis';

const GEMINI_MODEL = 'models/gemini-2.5-flash';
/** Separate model instance used for independent cross-verification. */
const GEMINI_VERIFY_MODEL = 'models/gemini-2.5-flash';
/** Gemini inline audio upload hard cap (20 MB). Files above this skip cloud enrichment. */
const GEMINI_INLINE_LIMIT = 20 * 1024 * 1024;

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

function buildEnhancementPrompt(blueprint: ReconstructionBlueprint): string {
  const lines = [
    'You are an Ableton Live 12 production expert with deep musical knowledge.',
    '',
    'The audio file above has been analysed by a local DSP engine.',
    'Use these measurements as ground truth — do NOT change them:',
    `  BPM: ${blueprint.telemetry.bpm}${blueprint.telemetry.bpmConfidence != null ? ` (confidence: ${Math.round(blueprint.telemetry.bpmConfidence * 100)}%)` : ''}`,
    `  Key: ${blueprint.telemetry.key}${blueprint.telemetry.keyConfidence != null ? ` (confidence: ${Math.round(blueprint.telemetry.keyConfidence * 100)}%)` : ''}`,
  ];

  if (blueprint.chordProgressionSummary) {
    lines.push(`  Chord progression: ${blueprint.chordProgressionSummary}`);
  }

  lines.push(
    '',
    'Listen to the audio and ENHANCE only the descriptive text fields.',
    'Do NOT modify BPM, key, time ranges, or element/artifact names.',
    '',
    'Return strict JSON with this shape only:',
    '{',
    '  "groove": "describe feel, micro-timing, and swing character",',
    '  "instrumentation": [{"element":"exact existing element name","timbre":"sound texture description","abletonDevice":"Ableton 12 device + precise settings"}],',
    '  "fxChain": [{"artifact":"exact existing artifact name","recommendation":"specific Ableton FX recommendation"}],',
    '  "secretSauce": {"trick":"unique production technique heard","execution":"step-by-step Ableton Live 12 recreation"}',
    '}',
    '',
    'Elements to enhance (use exact names):',
    JSON.stringify({
      instrumentation: blueprint.instrumentation.map((i) => ({ element: i.element })),
      fxChain: blueprint.fxChain.map((f) => ({ artifact: f.artifact })),
    })
  );

  return lines.join('\n');
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

/**
 * Gemini Provider — Hybrid mode.
 * Runs local DSP first (accurate BPM/key/spectrum/chords), then sends both
 * the audio AND the local measurements to Gemini 2.0 Flash so Gemini enriches
 * only the descriptive/creative text fields. This saves cost and gives better
 * measurement accuracy than asking Gemini to do everything from raw audio.
 *
 * Requires VITE_GEMINI_API_KEY (set GEMINI_API_KEY in .env.local).
 */
// ---------------------------------------------------------------------------
// Verification helpers
// ---------------------------------------------------------------------------

interface GeminiVerificationResult {
  bpm?: { agreed: boolean; geminiEstimate?: string; note?: string };
  key?: { agreed: boolean; geminiEstimate?: string; note?: string };
  chords?: { agreed: boolean; geminiEstimate?: string; note?: string };
  overallSummary?: string;
}

function buildVerificationPrompt(blueprint: ReconstructionBlueprint): string {
  const lines = [
    'You are an expert musicologist and audio engineer.',
    'Listen to this audio and INDEPENDENTLY verify the following local DSP measurements.',
    'Trust only your ears — do NOT assume the values below are correct.',
    '',
    `  Local BPM: ${blueprint.telemetry.bpm}`,
    `  Local Key: ${blueprint.telemetry.key}`,
  ];
  if (blueprint.chordProgressionSummary) {
    lines.push(`  Local Chords: ${blueprint.chordProgressionSummary}`);
  }
  lines.push(
    '',
    'Return ONLY strict JSON:',
    '{',
    '  "bpm":    { "agreed": true, "geminiEstimate": "your BPM estimate", "note": "optional" },',
    '  "key":    { "agreed": true, "geminiEstimate": "your key estimate", "note": "optional" },',
    '  "chords": { "agreed": true, "geminiEstimate": "your chord reading", "note": "optional" },',
    '  "overallSummary": "1-2 sentence accuracy verdict"',
    '}'
  );
  return lines.join('\n');
}

function formatVerificationNotes(raw: string, blueprint: ReconstructionBlueprint): string {
  let result: GeminiVerificationResult;
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    result = JSON.parse(cleaned) as GeminiVerificationResult;
  } catch {
    return 'Verification parsing failed — local DSP measurements stand.';
  }

  const icon = (agreed: boolean | undefined) => (agreed ? '✓' : '⚠');
  const parts: string[] = [];

  if (result.bpm) {
    parts.push(
      result.bpm.agreed
        ? `${icon(true)} BPM ${blueprint.telemetry.bpm} confirmed`
        : `${icon(false)} BPM: local ${blueprint.telemetry.bpm}, Gemini hears ~${result.bpm.geminiEstimate ?? '?'}${
            result.bpm.note ? ` (${result.bpm.note})` : ''
          }`
    );
  }
  if (result.key) {
    parts.push(
      result.key.agreed
        ? `${icon(true)} Key ${blueprint.telemetry.key} confirmed`
        : `${icon(false)} Key: local ${blueprint.telemetry.key}, Gemini hears ${result.key.geminiEstimate ?? '?'}${
            result.key.note ? ` (${result.key.note})` : ''
          }`
    );
  }
  if (result.chords) {
    parts.push(
      result.chords.agreed
        ? `${icon(true)} Chord progression confirmed`
        : `${icon(false)} Chords: ${result.chords.note ?? `Gemini hears ${result.chords.geminiEstimate ?? '?'}`}`
    );
  }

  const summary = result.overallSummary ? ` — ${result.overallSummary}` : '';
  return parts.length > 0 ? `${parts.join(' · ')}${summary}` : `Verification complete${summary}`;
}

// ---------------------------------------------------------------------------
// Chat
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
      model: GEMINI_MODEL,
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

export class GeminiProvider implements AnalysisProvider {
  name = 'Gemini 2.0 Flash (Cloud + Local DSP)';
  type = 'gemini' as const;

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

    // Step 1 — Local DSP: precise BPM, key, spectrum, chords (zero API cost)
    const audioBuffer = await decodeAudioFile(file);
    const { LocalAnalysisProvider } = await import('./localProvider');
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
          verificationNotes: `File is ${mb}MB — exceeds Gemini 20MB inline limit. Local DSP measurements used without cloud enrichment or verification.`,
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

    // Step 4 — Fire enrichment + independent verification concurrently
    // Both calls hear the audio; verification uses a focused cross-check prompt
    // so it cannot just echo back the local measurements.
    const ai = new GoogleGenAI({ apiKey });
    const audioPart = { inlineData: { data: base64, mimeType: file.type } };

    const [enrichmentResult, verificationResult] = await Promise.allSettled([
      ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ parts: [audioPart, { text: buildEnhancementPrompt(localBlueprint) }] }],
        config: { responseMimeType: 'application/json' },
      }),
      ai.models.generateContent({
        model: GEMINI_VERIFY_MODEL,
        contents: [{ parts: [audioPart, { text: buildVerificationPrompt(localBlueprint) }] }],
        config: { responseMimeType: 'application/json' },
      }),
    ]);

    const analysisTime = Math.round(performance.now() - startTime);

    // Merge enrichment (descriptions, timbre, Ableton device recommendations)
    const enrichText =
      enrichmentResult.status === 'fulfilled' ? (enrichmentResult.value.text ?? '{}') : '{}';
    const enhancement = parseGeminiEnhancement(enrichText);
    const merged = mergeGeminiEnhancement(localBlueprint, enhancement);

    // Merge verification notes (BPM/key/chord agreement from Gemini listening)
    const verifyNotes =
      verificationResult.status === 'fulfilled'
        ? formatVerificationNotes(verificationResult.value.text ?? '', localBlueprint)
        : 'Verification call failed — local DSP measurements stand.';

    return {
      ...merged,
      telemetry: {
        ...merged.telemetry,
        verificationNotes: verifyNotes,
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
}
