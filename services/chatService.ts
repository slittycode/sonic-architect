import { ReconstructionBlueprint } from '../types';
import { getStoredAnthropicApiKey } from './claudeProvider';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const key = getStoredAnthropicApiKey();
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
      return { done: true, error: parsed.error || 'Claude chat stream error' };
    }
  } catch {
    return { done: false, text: payload };
  }

  return { done: false };
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Claude chat request failed (${response.status})`;

  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    // non-JSON body
  }

  return text;
}

function streamSseText(
  body: ReadableStream<Uint8Array>,
  onText: (chunk: string) => void
): ReadableStream<string> {
  const decoder = new TextDecoder();

  return new ReadableStream<string>({
    async start(controller) {
      const reader = body.getReader();
      let buffer = '';

      try {
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
            if (parsed.error) {
              controller.error(new Error(parsed.error));
              return;
            }
            if (parsed.text) {
              onText(parsed.text);
              controller.enqueue(parsed.text);
            }
            if (parsed.done) {
              controller.close();
              return;
            }
          }
        }

        const parsed = parseSsePayload(buffer.trim());
        if (parsed.error) {
          controller.error(new Error(parsed.error));
          return;
        }
        if (parsed.text) {
          onText(parsed.text);
          controller.enqueue(parsed.text);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export class ClaudeChatService {
  private history: ChatMessage[] = [];

  constructor(
    private readonly getBlueprint: (() => ReconstructionBlueprint | null) | null = null
  ) {}

  async sendMessage(text: string): Promise<ReadableStream<string>> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error('Message text cannot be empty.');
    }

    const userMessage: ChatMessage = {
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };
    this.history.push(userMessage);

    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        mode: 'chat',
        blueprint: this.getBlueprint?.() ?? undefined,
        messages: this.history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }
    if (!response.body) {
      throw new Error('Claude chat stream is unavailable.');
    }

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    this.history.push(assistantMessage);

    return streamSseText(response.body, (chunk) => {
      assistantMessage.content += chunk;
    });
  }

  clearHistory(): void {
    this.history = [];
  }

  getHistory(): ChatMessage[] {
    return this.history.map((message) => ({ ...message }));
  }
}
