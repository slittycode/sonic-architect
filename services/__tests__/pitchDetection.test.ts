import { describe, expect, it } from 'vitest';
import { detectPitches, getFrameDurationSeconds } from '../pitchDetection';

describe('getFrameDurationSeconds', () => {
  it('uses runtime sample rate instead of a hardcoded constant', () => {
    const at44k = getFrameDurationSeconds(44100);
    const at48k = getFrameDurationSeconds(48000);
    const expected48k = 512 / 48000;

    expect(at48k).toBeCloseTo(expected48k, 10);
    expect(at48k).not.toBeCloseTo(at44k, 4);
  });

  it('rejects invalid sample rates', () => {
    expect(() => getFrameDurationSeconds(0)).toThrowError();
    expect(() => getFrameDurationSeconds(-1)).toThrowError();
  });
});

function createMockAudioBuffer(channel: Float32Array, sampleRate: number): AudioBuffer {
  return {
    sampleRate,
    numberOfChannels: 1,
    length: channel.length,
    duration: sampleRate > 0 ? channel.length / sampleRate : 0,
    getChannelData: () => channel,
  } as unknown as AudioBuffer;
}

function createSineBuffer(
  sampleRate: number,
  durationSeconds: number,
  frequency: number,
  amplitude: number = 0.6
): AudioBuffer {
  const length = Math.floor(sampleRate * durationSeconds);
  const channel = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    channel[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return createMockAudioBuffer(channel, sampleRate);
}

describe('detectPitches', () => {
  it('returns no notes for silence', async () => {
    const sampleRate = 44100;
    const channel = new Float32Array(sampleRate);
    const buffer = createMockAudioBuffer(channel, sampleRate);

    const result = await detectPitches(buffer, 120);
    expect(result.notes).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('returns coherent note timings for a stable tone', async () => {
    const buffer = createSineBuffer(44100, 0.7, 440);
    const result = await detectPitches(buffer, 120);

    expect(result.notes.length).toBeGreaterThan(0);
    const totalDuration = result.duration;

    for (let i = 0; i < result.notes.length; i++) {
      const note = result.notes[i];
      expect(note.duration).toBeGreaterThan(0);
      expect(note.startTime).toBeGreaterThanOrEqual(0);
      expect(note.startTime + note.duration).toBeLessThanOrEqual(totalDuration + 0.1);
      if (i > 0) {
        expect(note.startTime).toBeGreaterThanOrEqual(result.notes[i - 1].startTime);
      }
    }
  });
});
