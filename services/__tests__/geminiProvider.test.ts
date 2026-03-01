import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @google/genai before importing the services under test
// ---------------------------------------------------------------------------

const mockGenerateContentStream = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(function () {
    return {
      models: {
        generateContentStream: mockGenerateContentStream,
      },
    };
  }),
  FileState: { PROCESSING: 'PROCESSING', ACTIVE: 'ACTIVE', FAILED: 'FAILED' },
}));

import { GeminiProvider } from '@/services/gemini/geminiProvider';
import { GeminiChatService } from '@/services/gemini';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readAll(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let result = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    result += value;
  }
  return result;
}

async function* makeAsyncIterable(chunks: string[]) {
  for (const chunk of chunks) {
    yield { text: chunk };
  }
}

// ---------------------------------------------------------------------------
// GeminiProvider tests
// ---------------------------------------------------------------------------

describe('GeminiProvider', () => {
  describe('isAvailable()', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns true when VITE_GEMINI_API_KEY is set', async () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', 'valid-key');
      const provider = new GeminiProvider();
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when VITE_GEMINI_API_KEY is empty string', async () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', '');
      const provider = new GeminiProvider();
      expect(await provider.isAvailable()).toBe(false);
    });

    it('returns false when VITE_GEMINI_API_KEY is not present', async () => {
      vi.stubEnv('VITE_GEMINI_API_KEY', '');
      const provider = new GeminiProvider();
      expect(await provider.isAvailable()).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// GeminiChatService tests (authoritative copy is chatService.test.ts)
// ---------------------------------------------------------------------------

describe('GeminiChatService', () => {
  describe('when VITE_GEMINI_API_KEY is not set', () => {
    it('throws when sendMessage is called', async () => {
      const service = new GeminiChatService();
      await expect(service.sendMessage('hello')).rejects.toThrow(
        'Gemini API key not configured'
      );
    });
  });

  describe('when VITE_GEMINI_API_KEY is set', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_GEMINI_API_KEY', 'test-key-abc');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      mockGenerateContentStream.mockReset();
    });

    it('streams assistant text chunks via ReadableStream', async () => {
      mockGenerateContentStream.mockResolvedValue(makeAsyncIterable(['Hello ', 'world']));

      const service = new GeminiChatService();
      const stream = await service.sendMessage('hi');
      const result = await readAll(stream);

      expect(result).toBe('Hello world');
    });

    it('rejects empty message text without calling the API', async () => {
      const service = new GeminiChatService();
      await expect(service.sendMessage('   ')).rejects.toThrow('Message text cannot be empty');
      expect(mockGenerateContentStream).not.toHaveBeenCalled();
    });

    it('clearHistory() resets the conversation', async () => {
      mockGenerateContentStream.mockResolvedValue(makeAsyncIterable(['reply']));

      const service = new GeminiChatService();
      await readAll(await service.sendMessage('first'));
      service.clearHistory();

      mockGenerateContentStream.mockResolvedValue(makeAsyncIterable(['fresh']));
      await readAll(await service.sendMessage('second'));

      // After clearHistory, contents should only contain the second message
      const callArgs = mockGenerateContentStream.mock.calls[1][0];
      expect(callArgs.contents).toHaveLength(1);
      expect(callArgs.contents[0].parts[0].text).toBe('second');
    });
  });
});
