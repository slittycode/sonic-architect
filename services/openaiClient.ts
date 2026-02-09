/**
 * OpenAI REST Client
 *
 * Lightweight client for the OpenAI Chat Completions API.
 * Works with any OpenAI-compatible endpoint (OpenAI, Azure OpenAI, OpenRouter).
 */

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
}

export const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  apiKey: '',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
  temperature: 0.3,
};

/**
 * Send a prompt to OpenAI Chat Completions and return the assistant's text.
 * Requests JSON response format for structured output.
 */
export async function queryOpenAI(
  prompt: string,
  config: OpenAIConfig = DEFAULT_OPENAI_CONFIG
): Promise<string> {
  if (!config.apiKey) throw new Error('OpenAI API key is required.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a music production expert. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenAI error ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? '';
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verify the API key works by making a lightweight models list call.
 */
export async function isOpenAIAvailable(config: OpenAIConfig): Promise<boolean> {
  if (!config.apiKey) return false;
  try {
    const res = await fetch(`${config.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
