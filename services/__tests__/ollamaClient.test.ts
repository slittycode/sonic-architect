import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOllamaAvailable, queryOllama } from '../ollamaClient';

describe('ollamaClient', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('returns false when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    const isAvailable = await isOllamaAvailable();
    expect(isAvailable).toBe(false);
  });

  it('throws a descriptive error when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    await expect(queryOllama('test prompt')).rejects.toThrow(
      /Ollama error 500: Internal Server Error/
    );
  });
});
