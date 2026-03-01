import OpenAI from 'openai';

type OpenAIMode = 'analyze' | 'chat';

interface RequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface OpenAIRequestBody {
  messages: RequestMessage[];
  blueprint?: Record<string, unknown>;
  mode: OpenAIMode;
  audioBase64?: string;
  audioMimeType?: string;
}

const ANALYZE_SYSTEM_PROMPT =
  'You are an Ableton Live 12 production expert. You receive audio analysis data and enhance it with creative, actionable production advice. Preserve all measured values. Enrich descriptions with specific Ableton device settings, creative techniques, and professional production insights.';

const CHAT_SYSTEM_PROMPT =
  'You are an Ableton Live 12 production expert helping a music producer understand and recreate a track. You have the full analysis blueprint as context. Give specific, actionable advice using Ableton-native devices and techniques. Reference the blueprint data when relevant.';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function jsonResponse(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeMessages(input: unknown): RequestMessage[] {
  if (!Array.isArray(input)) return [];

  const output: RequestMessage[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;

    const role = (entry as { role?: unknown }).role;
    const content = (entry as { content?: unknown }).content;

    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    if (!content.trim()) continue;

    output.push({ role, content: content.trim() });
  }

  return output;
}

function buildSystemPrompt(mode: OpenAIMode, blueprint?: Record<string, unknown>): string {
  if (mode === 'analyze') return ANALYZE_SYSTEM_PROMPT;
  return `${CHAT_SYSTEM_PROMPT}\n\nBlueprint context:\n${JSON.stringify(blueprint ?? {}, null, 2)}`;
}

function parseRequestBody(raw: unknown): OpenAIRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const mode = body.mode;
  if (mode !== 'analyze' && mode !== 'chat') return null;

  return {
    mode,
    blueprint:
      body.blueprint && typeof body.blueprint === 'object' && !Array.isArray(body.blueprint)
        ? (body.blueprint as Record<string, unknown>)
        : undefined,
    messages: normalizeMessages(body.messages),
    audioBase64: typeof body.audioBase64 === 'string' ? body.audioBase64 : undefined,
    audioMimeType: typeof body.audioMimeType === 'string' ? body.audioMimeType : undefined,
  };
}

function sseChunk(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

type AudioFormat = 'mp3' | 'wav' | 'flac' | 'ogg' | 'webm' | 'pcm16';

function deriveAudioFormat(mime: string): AudioFormat {
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('webm')) return 'webm';
  return 'mp3';
}

/**
 * Analyze mode: GPT-4o Audio does not support streaming with audio input.
 * Collect the full response and emit it as a single SSE envelope.
 */
async function analyzeWithAudio(
  openai: OpenAI,
  body: OpenAIRequestBody
): Promise<ReadableStream<Uint8Array>> {
  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [];

  if (body.audioBase64 && body.audioMimeType) {
    userContent.push({
      type: 'input_audio',
      input_audio: {
        data: body.audioBase64,
        format: deriveAudioFormat(body.audioMimeType),
      },
    } as OpenAI.Chat.ChatCompletionContentPart);
  }

  const lastMessage = body.messages.at(-1);
  userContent.push({ type: 'text', text: lastMessage?.content ?? '' });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-audio-preview',
    messages: [
      { role: 'system', content: ANALYZE_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '';

  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sseChunk({ type: 'text_delta', text }));
      controller.enqueue(sseChunk({ type: 'done' }));
      controller.close();
    },
  });
}

/**
 * Chat mode: standard streaming with gpt-4o (text-only).
 */
async function streamChatResponse(
  openai: OpenAI,
  body: OpenAIRequestBody
): Promise<ReadableStream<Uint8Array>> {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    stream: true,
    messages: [
      { role: 'system', content: buildSystemPrompt(body.mode, body.blueprint) },
      ...body.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentDone = false;

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(sseChunk({ type: 'text_delta', text: delta }));
          }

          if (chunk.choices[0]?.finish_reason === 'stop') {
            controller.enqueue(sseChunk({ type: 'done' }));
            sentDone = true;
          }
        }

        if (!sentDone) {
          controller.enqueue(sseChunk({ type: 'done' }));
        }
        controller.close();
      } catch (error) {
        controller.enqueue(
          sseChunk({
            type: 'error',
            error: error instanceof Error ? error.message : 'OpenAI stream failed',
          })
        );
        controller.close();
      }
    },
  });
}

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    return jsonResponse(200, { ok: true });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'content-type,x-api-key',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const headerKey = req.headers.get('x-api-key')?.trim() ?? '';
  if (!headerKey) {
    return jsonResponse(401, {
      error: 'Missing OpenAI API key. Provide it in the x-api-key request header.',
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON request body.' });
  }

  const body = parseRequestBody(rawBody);
  if (!body) {
    return jsonResponse(400, {
      error: 'Invalid payload. Expected { messages, blueprint?, mode }.',
    });
  }
  if (body.messages.length === 0) {
    return jsonResponse(400, { error: 'At least one message is required.' });
  }

  try {
    const openai = new OpenAI({ apiKey: headerKey });
    const sse =
      body.mode === 'analyze'
        ? await analyzeWithAudio(openai, body)
        : await streamChatResponse(openai, body);
    return new Response(sse, { status: 200, headers: SSE_HEADERS });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'OpenAI request failed.',
    });
  }
}
