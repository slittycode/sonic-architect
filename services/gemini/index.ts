/**
 * Gemini service module — public re-exports.
 *
 * Import from './services/gemini' instead of './services/geminiService'.
 */
export {
  GeminiProvider,
  GeminiChatService,
  parseGeminiEnhancement,
  mergeGeminiEnhancement,
  mergeAudioAnalysis,
} from './geminiProvider';
export type { GeminiModelId } from './geminiProvider';
export { GEMINI_MODEL_LABELS } from './geminiProvider';
export type { AudioAnalysisResult } from './types/analysis';
export { validateAudioAnalysisResult } from './types/analysis';
