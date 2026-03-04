import type { ReconstructionBlueprint } from '../../../types';
import { DEFAULT_MODEL, createGeminiClient, modelPath } from './client';

const CHAT_SYSTEM_PROMPT =
  'You are an Ableton Live 12 production expert helping a music producer understand and ' +
  'recreate a track. Give specific, actionable advice using Ableton-native devices and ' +
  'techniques. Reference the blueprint data when relevant. Be concise but precise.';

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

    const ai = createGeminiClient(apiKey);
    const responseStream = await ai.models.generateContentStream({
      model: modelPath(DEFAULT_MODEL),
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
