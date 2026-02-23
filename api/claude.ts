import Anthropic from '@anthropic-ai/sdk';

type ClaudeMode = 'analyze' | 'chat';

interface RequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeRequestBody {
  messages: RequestMessage[];
  blueprint?: Record<string, unknown>;
  mode: ClaudeMode;
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

function buildSystemPrompt(mode: ClaudeMode, blueprint?: Record<string, unknown>): string {
  if (mode === 'analyze') return ANALYZE_SYSTEM_PROMPT;
  return `${CHAT_SYSTEM_PROMPT}\n\nBlueprint context:\n${JSON.stringify(blueprint ?? {}, null, 2)}`;
}

function parseRequestBody(raw: unknown): ClaudeRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Partial<ClaudeRequestBody>;
  const mode = body.mode;
  if (mode !== 'analyze' && mode !== 'chat') return null;

  return {
    mode,
    blueprint:
      body.blueprint && typeof body.blueprint === 'object' && !Array.isArray(body.blueprint)
        ? (body.blueprint as Record<string, unknown>)
        : undefined,
    messages: normalizeMessages(body.messages),
  };
}

function sseChunk(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamClaudeResponse(
  anthropic: Anthropic,
  body: ClaudeRequestBody,
): Promise<ReadableStream<Uint8Array>> {
  const stream = anthropic.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' } as any,
    system: buildSystemPrompt(body.mode, body.blueprint),
    messages: body.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let sentDone = false;

      try {
        for await (const event of stream as AsyncIterable<{
          type?: string;
          delta?: { type?: string; text?: string };
        }>) {
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            controller.enqueue(sseChunk({ type: 'text_delta', text: event.delta.text ?? '' }));
          }

          if (event.type === 'message_stop') {
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
            error: error instanceof Error ? error.message : 'Claude stream failed',
          }),
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

  const envKey = typeof process?.env?.ANTHROPIC_API_KEY === 'string' ? process.env.ANTHROPIC_API_KEY : '';
  const headerKey = req.headers.get('x-api-key')?.trim() ?? '';
  const apiKey = headerKey || envKey;

  if (!apiKey) {
    return jsonResponse(401, { error: 'Missing Anthropic API key.' });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON request body.' });
  }

  const body = parseRequestBody(rawBody);
  if (!body) {
    return jsonResponse(400, { error: 'Invalid payload. Expected { messages, blueprint?, mode }.' });
  }
  if (body.messages.length === 0) {
    return jsonResponse(400, { error: 'At least one message is required.' });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const sse = await streamClaudeResponse(anthropic, body);
    return new Response(sse, { status: 200, headers: SSE_HEADERS });
  } catch (error) {
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : 'Claude request failed.',
    });
  }
}
