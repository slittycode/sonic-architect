/**
 * AWS Bedrock Runtime Client
 *
 * Lightweight client for AWS Bedrock's InvokeModel API.
 * Uses the custom SigV4 implementation — no AWS SDK dependency.
 * Supports Claude, Llama, and Mistral model families.
 */

import { signRequest } from './awsSigV4';

export interface BedrockConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  modelId: string;
  temperature: number;
}

export const DEFAULT_BEDROCK_CONFIG: BedrockConfig = {
  accessKeyId: '',
  secretAccessKey: '',
  region: 'us-east-1',
  modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
  temperature: 0.3,
};

/** Well-known Bedrock model families and their display labels. */
export const BEDROCK_MODELS: Array<{ id: string; label: string }> = [
  { id: 'anthropic.claude-3-haiku-20240307-v1:0', label: 'Claude 3 Haiku' },
  { id: 'anthropic.claude-3-sonnet-20240229-v1:0', label: 'Claude 3 Sonnet' },
  { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet v2' },
  { id: 'meta.llama3-8b-instruct-v1:0', label: 'Llama 3 8B' },
  { id: 'meta.llama3-70b-instruct-v1:0', label: 'Llama 3 70B' },
  { id: 'mistral.mixtral-8x7b-instruct-v0:1', label: 'Mixtral 8×7B' },
  { id: 'mistral.mistral-large-2402-v1:0', label: 'Mistral Large' },
];

// ── Model-family request/response adapters ─────────────────────────────

function buildRequestBody(prompt: string, config: BedrockConfig): string {
  const model = config.modelId.toLowerCase();

  if (model.startsWith('anthropic.')) {
    return JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature,
    });
  }

  if (model.startsWith('meta.llama')) {
    return JSON.stringify({
      prompt: `<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n${prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n`,
      max_gen_len: 4096,
      temperature: config.temperature,
    });
  }

  if (model.startsWith('mistral.')) {
    return JSON.stringify({
      prompt: `<s>[INST] ${prompt} [/INST]`,
      max_tokens: 4096,
      temperature: config.temperature,
    });
  }

  // Fallback: generic Claude-like format
  return JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
    temperature: config.temperature,
  });
}

function extractResponseText(responseBody: any, modelId: string): string {
  const model = modelId.toLowerCase();

  if (model.startsWith('anthropic.')) {
    return responseBody.content?.[0]?.text ?? '';
  }

  if (model.startsWith('meta.llama')) {
    return responseBody.generation ?? '';
  }

  if (model.startsWith('mistral.')) {
    return responseBody.outputs?.[0]?.text ?? '';
  }

  // Fallback
  return responseBody.content?.[0]?.text ?? responseBody.generation ?? JSON.stringify(responseBody);
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Invoke a Bedrock model with the given prompt and return the response text.
 */
export async function queryBedrock(
  prompt: string,
  config: BedrockConfig = DEFAULT_BEDROCK_CONFIG
): Promise<string> {
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('AWS credentials are required for Bedrock.');
  }

  const endpoint = `https://bedrock-runtime.${config.region}.amazonaws.com`;
  const url = `${endpoint}/model/${encodeURIComponent(config.modelId)}/invoke`;
  const body = buildRequestBody(prompt, config);

  const headers = await signRequest({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body,
    service: 'bedrock',
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`Bedrock error ${response.status}: ${errBody || response.statusText}`);
    }

    const data = await response.json();
    return extractResponseText(data, config.modelId);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if Bedrock is reachable with the given credentials.
 * Makes a lightweight ListFoundationModels call.
 */
export async function isBedrockAvailable(config: BedrockConfig): Promise<boolean> {
  if (!config.accessKeyId || !config.secretAccessKey) return false;

  try {
    const endpoint = `https://bedrock.${config.region}.amazonaws.com`;
    const url = `${endpoint}/foundation-models?maxResults=1`;

    const headers = await signRequest({
      method: 'GET',
      url,
      headers: { 'Accept': 'application/json' },
      body: '',
      service: 'bedrock',
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });

    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
