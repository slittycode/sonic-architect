import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReconstructionBlueprint } from '../../types';
import { ClaudeChatService } from '../chatService';

function makeBlueprint(): ReconstructionBlueprint {
  return {
    telemetry: {
      bpm: '128',
      key: 'F Minor',
      groove: 'Tight and punchy',
    },
    arrangement: [{ timeRange: '0:00-0:20', label: 'Intro', description: 'Sparse' }],
    instrumentation: [
      {
        element: 'Kick',
        timbre: 'Deep',
        frequency: '40-100Hz',
        abletonDevice: 'Drum Rack',
      },
    ],
    fxChain: [{ artifact: 'Low-end shaping', recommendation: 'EQ Eight low shelf' }],
    secretSauce: { trick: 'Ghost kick', execution: 'Sidechain subtle pump' },
  };
}

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

async function readAll(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let output = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += value;
  }
  return output;
}

describe('ClaudeChatService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('streams assistant text and stores conversation history', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"type":"text_delta","text":"Try "}\n\n',
        'data: {"type":"text_delta","text":"a saturator."}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const service = new ClaudeChatService(() => makeBlueprint());
    const stream = await service.sendMessage('How do I add warmth?');
    const text = await readAll(stream);

    expect(text).toBe('Try a saturator.');
    const history = service.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ role: 'user', content: 'How do I add warmth?' });
    expect(history[1]).toMatchObject({ role: 'assistant', content: 'Try a saturator.' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clearHistory removes all messages', () => {
    const service = new ClaudeChatService(() => makeBlueprint());
    service.clearHistory();
    expect(service.getHistory()).toEqual([]);
  });
});
