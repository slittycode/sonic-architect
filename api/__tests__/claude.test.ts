import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { anthropicStreamMock } = vi.hoisted(() => ({
  anthropicStreamMock: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class AnthropicMock {
    messages = {
      stream: anthropicStreamMock,
    };
  },
}));

import handler from '../claude';

function makeRequest(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request('https://example.com/api/claude', {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('/api/claude handler', () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalApiKey) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('returns ok for GET health checks', async () => {
    const response = await handler(makeRequest('GET'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('returns CORS headers for OPTIONS', async () => {
    const response = await handler(makeRequest('OPTIONS'));
    expect(response.status).toBe(204);
    expect(response.headers.get('Allow')).toBe('GET,POST,OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('content-type,x-api-key');
  });

  it('rejects unsupported methods', async () => {
    const response = await handler(makeRequest('PUT'));
    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({ error: 'Method not allowed' });
  });

  it('requires an API key in the request header', async () => {
    const response = await handler(
      makeRequest('POST', {
        mode: 'chat',
        messages: [{ role: 'user', content: 'hello' }],
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing Anthropic API key. Provide it in the x-api-key request header.',
    });
  });

  it('does not allow environment key fallback without request header', async () => {
    process.env.ANTHROPIC_API_KEY = 'server-key';

    const response = await handler(
      makeRequest('POST', {
        mode: 'chat',
        messages: [{ role: 'user', content: 'hello' }],
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing Anthropic API key. Provide it in the x-api-key request header.',
    });
  });

  it('rejects invalid JSON payloads', async () => {
    const response = await handler(
      makeRequest('POST', '{invalid-json}', { 'x-api-key': 'test-key' })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid JSON request body.' });
  });

  it('rejects invalid payload shape', async () => {
    const response = await handler(
      makeRequest(
        'POST',
        {
          mode: 'unsupported-mode',
          messages: [{ role: 'user', content: 'hello' }],
        },
        { 'x-api-key': 'test-key' }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid payload. Expected { messages, blueprint?, mode }.',
    });
  });

  it('rejects payloads with no valid messages', async () => {
    const response = await handler(
      makeRequest(
        'POST',
        {
          mode: 'chat',
          messages: [{ role: 'user', content: '   ' }],
        },
        { 'x-api-key': 'test-key' }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'At least one message is required.' });
  });

  it('streams text_delta and done SSE events for valid chat requests', async () => {
    anthropicStreamMock.mockReturnValue(
      (async function* mockEvents() {
        yield {
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: 'Try saturator.' },
        };
        yield { type: 'message_stop' };
      })()
    );

    const response = await handler(
      makeRequest(
        'POST',
        {
          mode: 'chat',
          blueprint: { telemetry: { bpm: '128' } },
          messages: [{ role: 'user', content: 'Need warmth tips' }],
        },
        { 'x-api-key': 'test-key' }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(anthropicStreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-6',
        messages: [{ role: 'user', content: 'Need warmth tips' }],
      })
    );

    const bodyText = await response.text();
    expect(bodyText).toContain('"type":"text_delta"');
    expect(bodyText).toContain('"text":"Try saturator."');
    expect(bodyText).toContain('"type":"done"');
  });
});
