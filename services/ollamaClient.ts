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

// localStorage keys
const OLLAMA_BASEURL_KEY = 'sonic_ollama_baseurl';
const OLLAMA_MODEL_KEY = 'sonic_ollama_model';
const OLLAMA_TEMP_KEY = 'sonic_ollama_temp';

function normalizeBaseUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  // Add http:// if no protocol specified
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

export function getStoredOllamaConfig(): Partial<OllamaConfig> {
  try {
    const baseUrl = localStorage.getItem(OLLAMA_BASEURL_KEY);
    const model = localStorage.getItem(OLLAMA_MODEL_KEY);
    const temp = localStorage.getItem(OLLAMA_TEMP_KEY);
    return {
      ...(normalizeBaseUrl(baseUrl) && { baseUrl: normalizeBaseUrl(baseUrl) }),
      ...(model && { model: model.trim() }),
      ...(temp && { temperature: parseFloat(temp) }),
    };
  } catch {
    return {};
  }
}

export function setStoredOllamaBaseUrl(value: string): void {
  try {
    if (value) localStorage.setItem(OLLAMA_BASEURL_KEY, value);
    else localStorage.removeItem(OLLAMA_BASEURL_KEY);
  } catch {}
}

export function setStoredOllamaModel(value: string): void {
  try {
    if (value) localStorage.setItem(OLLAMA_MODEL_KEY, value);
    else localStorage.removeItem(OLLAMA_MODEL_KEY);
  } catch {}
}

export function setStoredOllamaTemperature(value: string): void {
  try {
    if (value) localStorage.setItem(OLLAMA_TEMP_KEY, value);
    else localStorage.removeItem(OLLAMA_TEMP_KEY);
  } catch {}
}

/**
 * Check if a specific model is available (pulled) on the Ollama server.
 */
export async function isModelPulled(
  modelName: string,
  baseUrl: string = DEFAULT_OLLAMA_CONFIG.baseUrl
): Promise<boolean> {
  const models = await listOllamaModels(baseUrl);
  const found = models.some((m) => {
    // Match if:
    // 1. Exact match: "llama3.2:latest" === "llama3.2:latest"
    // 2. Configured name is prefix of installed: "llama3.2" matches "llama3.2:latest"
    // 3. Base names match (strip tags): "llama3.2" === "llama3.2"
    const installedBase = m.split(':')[0];
    const configBase = modelName.split(':')[0];
    const match = m === modelName || 
                  m.startsWith(`${modelName}:`) || 
                  installedBase === configBase;
    return match;
  });
  console.log(`[Ollama] Checking for model "${modelName}", found: ${found}`);
  return found;
}

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
    if (!res.ok) {
      console.warn('[Ollama] Failed to list models:', res.status, res.statusText);
      return [];
    }
    const data = await res.json();
    const models = parseModelNames(data);
    console.log('[Ollama] Available models:', models);
    return models;
  } catch (err) {
    console.warn('[Ollama] Error listing models:', err);
    return [];
  }
}
