import { GoogleGenAI } from '@google/genai';

export type GeminiModelId =
  | 'gemini-2.0-flash'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-3-flash-preview'
  | 'gemini-3.1-flash-preview'
  | 'gemini-3.1-pro-preview';

export type GeminiModelGroup = 'experimental' | 'stable' | 'preview';

export const GEMINI_MODELS: { id: GeminiModelId; label: string; group: GeminiModelGroup }[] = [
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', group: 'experimental' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'stable' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', group: 'stable' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)', group: 'preview' },
  { id: 'gemini-3.1-flash-preview', label: 'Gemini 3.1 Flash (Preview)', group: 'preview' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', group: 'preview' },
];

export const GEMINI_MODEL_LABELS: Record<GeminiModelId, string> = Object.fromEntries(
  GEMINI_MODELS.map((m) => [m.id, m.label])
) as Record<GeminiModelId, string>;

export const DEFAULT_MODEL: GeminiModelId = 'gemini-2.5-flash';

/**
 * Preview models produce significantly shorter/shallower output when forced
 * into responseMimeType: 'application/json'. Let them respond in free-text
 * mode and extract JSON from the response instead.
 */
export const MODELS_WITHOUT_JSON_MODE = new Set<GeminiModelId>([
  'gemini-3-flash-preview',
  'gemini-3.1-flash-preview',
  'gemini-3.1-pro-preview',
]);

export function modelPath(modelId: GeminiModelId): string {
  return `models/${modelId}`;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}
