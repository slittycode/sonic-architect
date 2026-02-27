import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { decodeAudioFile } from './audioAnalysis';
import { LocalAnalysisProvider } from './localProvider';

export const OPENAI_API_KEY_STORAGE_KEY = 'openai_api_key';

/** Files above 25 MB skip audio upload and fall back to text-only enrichment. */
const OPENAI_AUDIO_LIMIT = 25 * 1024 * 1024;

interface OpenAIEnhancement {
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

function buildAnalyzePrompt(blueprint: ReconstructionBlueprint): string {
  return [
    'Enhance descriptive text only. Do not change measured values.',
    '',
    'Return strict JSON with this shape only:',
    '{',
    '  "groove": "optional string",',
    '  "instrumentation": [{"element":"exact existing element","timbre":"optional","abletonDevice":"optional"}],',
    '  "fxChain": [{"artifact":"exact existing artifact","recommendation":"optional"}],',
    '  "secretSauce": {"trick":"optional","execution":"optional"}',
    '}',
    '',
    'Blueprint:',
    JSON.stringify(blueprint),
  ].join('\n');
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!withoutFence.startsWith('{')) {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return withoutFence.slice(start, end + 1);
    }
  }

  return withoutFence;
}

function parseEnhancement(raw: string): OpenAIEnhancement | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(extractJson(raw)) as OpenAIEnhancement;
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

function mergeEnhancement(
  blueprint: ReconstructionBlueprint,
  enhancement: OpenAIEnhancement | null
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
      const index = merged.instrumentation.findIndex((item) => item.element === update.element);
      if (index === -1) continue;
      if (typeof update.timbre === 'string' && update.timbre.trim()) {
        merged.instrumentation[index].timbre = update.timbre.trim();
      }
      if (typeof update.abletonDevice === 'string' && update.abletonDevice.trim()) {
        merged.instrumentation[index].abletonDevice = update.abletonDevice.trim();
      }
    }
  }

  if (Array.isArray(enhancement.fxChain)) {
    for (const update of enhancement.fxChain) {
      if (!update?.artifact) continue;
      const index = merged.fxChain.findIndex((item) => item.artifact === update.artifact);
      if (index === -1) continue;
      if (typeof update.recommendation === 'string' && update.recommendation.trim()) {
        merged.fxChain[index].recommendation = update.recommendation.trim();
      }
    }
  }

  if (enhancement.secretSauce) {
    if (typeof enhancement.secretSauce.trick === 'string' && enhancement.secretSauce.trick.trim()) {
      merged.secretSauce.trick = enhancement.secretSauce.trick.trim();
    }
    if (
      typeof enhancement.secretSauce.execution === 'string' &&
      enhancement.secretSauce.execution.trim()
    ) {
      merged.secretSauce.execution = enhancement.secretSauce.execution.trim();
    }
  }

  return merged;
}

// ── localStorage key helpers ────────────────────────────────────────────────

export function getStoredOpenAIApiKey(): string | null {
  try {
    const key = localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY);
    if (typeof key === 'string' && key.trim()) return key.trim();
  } catch {
    // no-op for non-browser contexts
  }
  return null;
}

export function setStoredOpenAIApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
      return;
    }
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmed);
  } catch {
    // no-op for non-browser contexts
  }
}

// ── SSE helpers (same wire format as api/openai.ts) ─────────────────────────

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = getStoredOpenAIApiKey();
  if (key) headers['x-api-key'] = key;
  return headers;
}

function parseSsePayload(payload: string): {
  done: boolean;
  text?: string;
  error?: string;
} {
  if (!payload) return { done: false };
  if (payload === '[DONE]') return { done: true };

  try {
    const parsed = JSON.parse(payload) as {
      type?: string;
      text?: string;
      error?: string;
    };
    if (parsed.type === 'text_delta') {
      return { done: false, text: typeof parsed.text === 'string' ? parsed.text : '' };
    }
    if (parsed.type === 'done') return { done: true };
    if (parsed.type === 'error') {
      return { done: true, error: parsed.error || 'OpenAI stream error' };
    }
  } catch {
    return { done: false, text: payload };
  }

  return { done: false };
}

async function readSseText(response: Response): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary === -1) break;

      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const data = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');

      const parsed = parseSsePayload(data);
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.text) output += parsed.text;
      if (parsed.done) return output;
    }
  }

  const parsed = parseSsePayload(buffer.trim());
  if (parsed.error) throw new Error(parsed.error);
  if (parsed.text) output += parsed.text;

  return output;
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `OpenAI API request failed (${response.status})`;

  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // non-JSON body
  }

  return text;
}

// ── File → base64 helper ────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g. "data:audio/mpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read audio file.'));
    reader.readAsDataURL(file);
  });
}

// ── Provider class ──────────────────────────────────────────────────────────

export class OpenAIAnalysisProvider implements AnalysisProvider {
  name = 'GPT-4o Audio (Cloud + Local DSP)';
  type = 'openai' as const;

  constructor(
    private readonly localProvider: LocalAnalysisProvider = new LocalAnalysisProvider()
  ) {}

  async isAvailable(): Promise<boolean> {
    if (getStoredOpenAIApiKey()) return true;

    try {
      const response = await fetch('/api/openai', { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  async analyze(file: File): Promise<ReconstructionBlueprint> {
    const startTime = performance.now();

    // Always run local DSP first
    const audioBuffer = await decodeAudioFile(file);
    const localBlueprint = await this.localProvider.analyzeAudioBuffer(audioBuffer);

    // Encode audio for GPT-4o if within size limit
    let audioBase64: string | undefined;
    let audioMimeType: string | undefined;
    if (file.size <= OPENAI_AUDIO_LIMIT) {
      audioBase64 = await fileToBase64(file);
      audioMimeType = file.type || 'audio/mpeg';
    } else {
      console.warn(
        `[OpenAI] File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds 25 MB limit — skipping audio upload, text-only enrichment.`
      );
    }

    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          mode: 'analyze',
          blueprint: localBlueprint,
          audioBase64,
          audioMimeType,
          messages: [
            {
              role: 'user',
              content: buildAnalyzePrompt(localBlueprint),
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const raw = await readSseText(response);
      const enhancement = parseEnhancement(raw);
      const merged = mergeEnhancement(localBlueprint, enhancement);

      return {
        ...merged,
        meta: merged.meta
          ? {
              ...merged.meta,
              provider: 'openai',
              analysisTime: Math.round(performance.now() - startTime),
            }
          : undefined,
      };
    } catch {
      return {
        ...localBlueprint,
        meta: localBlueprint.meta
          ? {
              ...localBlueprint.meta,
              provider: 'openai',
              analysisTime: Math.round(performance.now() - startTime),
            }
          : undefined,
      };
    }
  }
}
