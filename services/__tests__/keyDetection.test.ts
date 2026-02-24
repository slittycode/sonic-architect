import { describe, it, expect } from 'vitest';
import { detectKey } from '../keyDetection';

function createMockAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    getChannelData: (index: number) => channels[index],
  } as unknown as AudioBuffer;
}

describe('Key Detection', () => {
  it('returns valid root and scale strings', () => {
    const sampleRate = 44100;
    const duration = 1;
    const length = sampleRate * duration;
    const channel = new Float32Array(length);

    // 440Hz sine wave (A)
    const freq = 440;
    for (let i = 0; i < length; i++) {
      channel[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }

    const buffer = createMockAudioBuffer([channel], sampleRate);
    const result = detectKey(buffer);

    expect(typeof result.root).toBe('string');
    expect(typeof result.scale).toBe('string');
    expect(result.root).toBeTruthy();
    expect(['Major', 'Minor']).toContain(result.scale);
  });

  it('handles silent/empty buffer without throwing', () => {
    const sampleRate = 44100;
    const length = sampleRate * 1;
    const silentAudio = new Float32Array(length);
    const buffer = createMockAudioBuffer([silentAudio], sampleRate);

    const result = detectKey(buffer);
    expect(result).toBeDefined();
    expect(typeof result.root).toBe('string');
  });

  it('handles long buffers while returning a valid key shape', () => {
    const sampleRate = 44100;
    const duration = 20;
    const length = sampleRate * duration;
    const channel = new Float32Array(length);

    const freq = 220; // A3
    for (let i = 0; i < length; i++) {
      channel[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }

    const buffer = createMockAudioBuffer([channel], sampleRate);
    const result = detectKey(buffer);

    expect(typeof result.root).toBe('string');
    expect(['Major', 'Minor']).toContain(result.scale);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
