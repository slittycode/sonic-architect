import { GoogleGenAI } from '@google/genai';
import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { decodeAudioFile, extractAudioFeatures } from './audioAnalysis';
import { generateMixReport } from './mixDoctor';

export type GeminiModelId = 'gemini-2.0-flash' | 'gemini-2.5-flash' | 'gemini-2.5-pro';

export const GEMINI_MODEL_LABELS: Record<GeminiModelId, string> = {
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
};

const DEFAULT_MODEL: GeminiModelId = 'gemini-2.5-flash';
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
    'For each instrumentation element, include in "abletonDevice":',
    '  1. Full Ableton 12 device chain (e.g. "Operator > Saturator > Reverb")',
    '  2. Key parameter settings (FM ratios, ADSR values, drive/mix amounts)',
    '  3. Sidechain routing if this element triggers ducking',
    '',
    'For each instrumentation element, include in "timbre":',
    '  1. Synthesis method (subtractive, FM, wavetable, sampler, granular)',
    '  2. Approximate MIDI note range (e.g. "C2–C5")',
    '  3. Key patch descriptors for recreation in Vital or Ableton Operator',
    '',
    'For fxChain, describe the full signal chain including:',
    '  1. Specific device settings (threshold, ratio, attack, release)',
    '  2. Sidechain compression setup if applicable (source track, amount)',
    '  3. Return channel vs insert distinction',
    '',
    'For secretSauce, provide step-by-step Ableton Live 12 implementation',
    'using only native devices.',
    '',
    'Return strict JSON with this shape only:',
    '{',
    '  "groove": "describe feel, micro-timing, and swing character",',
    '  "instrumentation": [{"element":"exact existing element name","timbre":"synthesis type + MIDI range + texture","abletonDevice":"device chain + parameter settings"}],',
    '  "fxChain": [{"artifact":"exact existing artifact name","recommendation":"FX chain + device settings + sidechain routing"}],',
    '  "secretSauce": {"trick":"unique production technique heard","execution":"step-by-step Ableton Live 12 recreation with native devices"}',
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
 * the audio AND the local measurements to Gemini so it enriches
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
  /** Genre classification for Mix Doctor scoring. */
  genre?: { detected: string; note?: string };
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
    'Also classify the genre/style of this track. Choose the single best match from:',
    '  edm, hiphop, rock, pop, acoustic, techno, house, ambient, dnb, garage',
    '',
    'Also note in "overallSummary":',
    '  - Whether the mix has audible sidechain compression (pumping/ducking)',
    '  - Whether brickwall limiting artifacts are present',
    '  - 1–2 specific Ableton 12 device chain tips based on the dominant mix characteristic',
    '',
    'Return ONLY strict JSON:',
    '{',
    '  "bpm":    { "agreed": true, "geminiEstimate": "your BPM estimate", "note": "optional" },',
    '  "key":    { "agreed": true, "geminiEstimate": "your key estimate", "note": "optional" },',
    '  "chords": { "agreed": true, "geminiEstimate": "your chord reading", "note": "optional" },',
    '  "genre":  { "detected": "one of edm|hiphop|rock|pop|acoustic|techno|house|ambient|dnb|garage", "note": "optional" },',
    '  "overallSummary": "1-2 sentence accuracy verdict + sidechain/limiting observations + Ableton tips"',
    '}'
  );
  return lines.join('\n');
}

/** Structured corrections extracted from Gemini verification. */
interface VerificationCorrections {
  /** Gemini's key estimate — only set when Gemini disagreed with local DSP. */
  key?: string;
  /** Gemini's BPM estimate — only set when Gemini disagreed with local DSP. */
  bpm?: string;
  /** Genre ID for Mix Doctor scoring (always set when parse succeeds). */
  genre?: string;
  /** Human-readable verification notes string. */
  notes: string;
}

function parseVerification(
  raw: string,
  blueprint: ReconstructionBlueprint
): VerificationCorrections {
  let result: GeminiVerificationResult;
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    result = JSON.parse(cleaned) as GeminiVerificationResult;
  } catch {
    return { notes: 'Verification parsing failed — local DSP measurements stand.' };
  }

  const icon = (agreed: boolean | undefined) => (agreed ? '\u2713' : '\u26a0');
  const parts: string[] = [];
  const corrections: VerificationCorrections = { notes: '' };

  // BPM
  if (result.bpm) {
    if (result.bpm.agreed) {
      parts.push(`${icon(true)} BPM ${blueprint.telemetry.bpm} confirmed`);
    } else {
      const est = result.bpm.geminiEstimate ?? '?';
      parts.push(
        `${icon(false)} BPM: local ${blueprint.telemetry.bpm}, Gemini hears ~${est}${
          result.bpm.note ? ` (${result.bpm.note})` : ''
        }`
      );
      corrections.bpm = est;
    }
  }

  // Key
  if (result.key) {
    if (result.key.agreed) {
      parts.push(`${icon(true)} Key ${blueprint.telemetry.key} confirmed`);
    } else {
      const est = result.key.geminiEstimate ?? '?';
      parts.push(
        `${icon(false)} Key: local ${blueprint.telemetry.key}, Gemini hears ${est}${
          result.key.note ? ` (${result.key.note})` : ''
        }`
      );
      corrections.key = est;
    }
  }

  // Chords
  if (result.chords) {
    parts.push(
      result.chords.agreed
        ? `${icon(true)} Chord progression confirmed`
        : `${icon(false)} Chords: ${result.chords.note ?? `Gemini hears ${result.chords.geminiEstimate ?? '?'}`}`
    );
  }

  // Genre
  if (result.genre?.detected) {
    const validGenres = ['edm', 'hiphop', 'rock', 'pop', 'acoustic', 'techno', 'house', 'ambient', 'dnb', 'garage'];
    const normalised = result.genre.detected.toLowerCase().trim();
    if (validGenres.includes(normalised)) {
      corrections.genre = normalised;
    }
  }

  const summary = result.overallSummary ? ` — ${result.overallSummary}` : '';
  corrections.notes =
    parts.length > 0 ? `${parts.join(' · ')}${summary}` : `Verification complete${summary}`;
  return corrections;
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

    const modelPath = `models/${this.modelId}`;
    const [enrichmentResult, verificationResult] = await Promise.allSettled([
      ai.models.generateContent({
        model: modelPath,
        contents: [{ parts: [audioPart, { text: buildEnhancementPrompt(localBlueprint) }] }],
        config: { responseMimeType: 'application/json' },
      }),
      ai.models.generateContent({
        model: modelPath,
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

    // Parse verification — extract structured corrections (key, BPM, genre)
    const corrections: VerificationCorrections =
      verificationResult.status === 'fulfilled'
        ? parseVerification(verificationResult.value.text ?? '', localBlueprint)
        : { notes: 'Verification call failed — local DSP measurements stand.' };

    // Apply key/BPM corrections when Gemini disagrees with local DSP
    const telemetry = { ...merged.telemetry, verificationNotes: corrections.notes };

    if (corrections.key) {
      telemetry.localKeyEstimate = merged.telemetry.key;
      telemetry.key = corrections.key;
      telemetry.keyCorrectedByGemini = true;
    }
    if (corrections.bpm) {
      telemetry.localBpmEstimate = merged.telemetry.bpm;
      telemetry.bpm = corrections.bpm;
      telemetry.bpmCorrectedByGemini = true;
    }
    if (corrections.genre) {
      telemetry.detectedGenre = corrections.genre;
    }

    // Re-score Mix Doctor with the Gemini-detected genre (if available)
    // This requires re-extracting features — we already have the audioBuffer.
    let mixReport = merged.mixReport;
    if (corrections.genre) {
      const features = extractAudioFeatures(audioBuffer);
      mixReport = generateMixReport(features, corrections.genre);
    }

    return {
      ...merged,
      telemetry,
      mixReport,
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
