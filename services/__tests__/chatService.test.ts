import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @google/genai before importing the service under test
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
// Tests
// ---------------------------------------------------------------------------

describe('GeminiChatService', () => {
  describe('when VITE_GEMINI_API_KEY is not set', () => {
    it('throws when sendMessage is called', async () => {
      const service = new GeminiChatService();
      await expect(service.sendMessage('hello')).rejects.toThrow('Gemini API key not configured');
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

    it('calls the Gemini API with the user message in contents', async () => {
      mockGenerateContentStream.mockResolvedValue(makeAsyncIterable(['ok']));

      const service = new GeminiChatService();
      await readAll(await service.sendMessage('test message'));

      expect(mockGenerateContentStream).toHaveBeenCalledOnce();
      const callArgs = mockGenerateContentStream.mock.calls[0][0];
      expect(callArgs.contents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', parts: [{ text: 'test message' }] }),
        ])
      );
    });

    it('rejects empty message text without calling the API', async () => {
      const service = new GeminiChatService();
      await expect(service.sendMessage('   ')).rejects.toThrow('Message text cannot be empty');
      expect(mockGenerateContentStream).not.toHaveBeenCalled();
    });

    it('includes blueprint context in system instruction when provided', async () => {
      mockGenerateContentStream.mockResolvedValue(makeAsyncIterable(['noted']));

      const blueprint = { meta: { provider: 'gemini' } } as never;
      const service = new GeminiChatService(() => blueprint);
      await readAll(await service.sendMessage('describe the track'));

      const callArgs = mockGenerateContentStream.mock.calls[0][0];
      expect(callArgs.config.systemInstruction).toContain('Blueprint context');
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
