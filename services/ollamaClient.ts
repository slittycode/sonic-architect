/**
 * Ollama HTTP Client
 *
 * Lightweight client for the Ollama local LLM REST API.
 * Ollama exposes endpoints at http://localhost:11434 by default.
 * Supports any OpenAI-compatible local endpoint (LM Studio, llama.cpp, etc.)
 */

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature: number;
}

export const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'llama3.2',
  temperature: 0.3,
};

interface OllamaTagsPayload {
  models?: Array<{ name?: unknown }>;
}

function parseModelNames(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const models = (payload as OllamaTagsPayload).models;
  if (!Array.isArray(models)) return [];

  return models
    .map((model) => (typeof model?.name === 'string' ? model.name : null))
    .filter((name): name is string => Boolean(name));
}

/**
 * Query Ollama's generate endpoint and return the response text.
 * Uses `format: 'json'` to request structured JSON output.
 */
export async function queryOllama(
  prompt: string,
  config: OllamaConfig = DEFAULT_OLLAMA_CONFIG,
  signal?: AbortSignal
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
    if (signal.aborted) controller.abort();
  }

  try {
    const response = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: config.temperature },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama error ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();
    return data.response ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if an Ollama-compatible server is reachable.
 * Returns true if the /api/tags endpoint responds within 2 seconds.
 */
export async function isOllamaAvailable(
  baseUrl: string = DEFAULT_OLLAMA_CONFIG.baseUrl
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * List available models from the Ollama server.
 */
export async function listOllamaModels(
  baseUrl: string = DEFAULT_OLLAMA_CONFIG.baseUrl
): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return parseModelNames(data);
  } catch {
    return [];
  }
}
