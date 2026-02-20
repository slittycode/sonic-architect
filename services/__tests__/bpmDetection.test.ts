import { describe, expect, it } from 'vitest';
import { detectBPM } from '../bpmDetection';

function createMockAudioBuffer(
  channels: Float32Array[],
  sampleRate: number,
): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    getChannelData: (index: number) => channels[index],
  } as unknown as AudioBuffer;
}

function createPulseTrainAudio(
  bpm: number,
  durationSeconds: number,
  sampleRate: number = 48_000,
): AudioBuffer {
  const length = Math.floor(durationSeconds * sampleRate);
  const channel = new Float32Array(length);
  const beatIntervalSamples = Math.floor((60 / bpm) * sampleRate);
  const pulseLength = Math.max(1, Math.floor(sampleRate * 0.03));

  for (let start = 0; start < length; start += beatIntervalSamples) {
    for (let i = 0; i < pulseLength && start + i < length; i++) {
      const decay = Math.exp((-6 * i) / pulseLength);
      channel[start + i] += 0.9 * decay;
    }
  }

  return createMockAudioBuffer([channel], sampleRate);
}

describe('detectBPM', () => {
  it('returns { bpm: number, confidence: number }', () => {
    const buffer = createPulseTrainAudio(120, 8);
    const result = detectBPM(buffer);

    expect(result).toEqual({
      bpm: expect.any(Number),
      confidence: expect.any(Number),
    });
  });

  it('returns BPM between 60 and 200 for valid audio', () => {
    const buffer = createPulseTrainAudio(120, 8);
    const result = detectBPM(buffer);

    expect(result.bpm).toBeGreaterThanOrEqual(60);
    expect(result.bpm).toBeLessThanOrEqual(200);
  });

  it('returns confidence between 0 and 1', () => {
    const buffer = createPulseTrainAudio(120, 8);
    const result = detectBPM(buffer);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('returns { bpm: 120, confidence: 0 } for very short audio (< 2 frames)', () => {
    const sampleRate = 48_000;
    const shortLength = 1_500;
    const shortAudio = new Float32Array(shortLength);
    const buffer = createMockAudioBuffer([shortAudio], sampleRate);

    expect(detectBPM(buffer)).toEqual({ bpm: 120, confidence: 0 });
  });
});
