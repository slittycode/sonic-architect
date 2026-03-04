/**
 * Compatibility wrapper for legacy imports.
 *
 * Main Gemini provider implementation now lives under services/providers/gemini.
 */
export { GeminiProvider } from '../providers/gemini/provider';
export { GeminiChatService } from '../providers/gemini/chat';
export {
  DEFAULT_MODEL,
  GEMINI_MODELS,
  GEMINI_MODEL_LABELS,
  type GeminiModelId,
  type GeminiModelGroup,
} from '../providers/gemini/client';
