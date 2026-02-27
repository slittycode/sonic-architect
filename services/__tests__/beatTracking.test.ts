import { describe, it, expect } from 'vitest';
import { trackBeats } from '../bpmDetection';

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

/** Create a pulse train at a specific BPM with optional accent on beat 1. */
function createPulseTrainAudio(
  bpm: number,
  durationSeconds: number,
  sampleRate: number = 48000,
  accentBeat1: boolean = false
): AudioBuffer {
  const length = Math.floor(durationSeconds * sampleRate);
  const channel = new Float32Array(length);
  const beatIntervalSamples = Math.floor((60 / bpm) * sampleRate);
  const pulseLength = Math.max(1, Math.floor(sampleRate * 0.01));

  let beatIndex = 0;
  for (let start = 0; start < length; start += beatIntervalSamples) {
    const isDownbeat = accentBeat1 && beatIndex % 4 === 0;
    const amplitude = isDownbeat ? 1.0 : 0.7;
    for (let i = 0; i < pulseLength && start + i < length; i++) {
      channel[start + i] = amplitude * Math.exp((-8 * i) / pulseLength);
    }
    beatIndex++;
  }

  return createMockAudioBuffer([channel], sampleRate);
}

describe('trackBeats (DP beat tracker)', () => {
  it('returns beat positions for a regular pulse train', () => {
    const buffer = createPulseTrainAudio(120, 8);
    const result = trackBeats(buffer, 120);

    expect(result.beats.length).toBeGreaterThan(5);
    expect(result.bpm).toBe(120);
    expect(result.downbeat).toBeGreaterThanOrEqual(0);
  });

  it('returns beats spaced approximately at the expected interval', () => {
    const bpm = 120;
    const expectedInterval = 60 / bpm; // 0.5 seconds
    const buffer = createPulseTrainAudio(bpm, 8);
    const result = trackBeats(buffer, bpm);

    // Check intervals between consecutive beats
    const intervals: number[] = [];
    for (let i = 1; i < result.beats.length; i++) {
      intervals.push(result.beats[i] - result.beats[i - 1]);
    }

    // Average interval should be close to expected
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    expect(avgInterval).toBeGreaterThan(expectedInterval * 0.7);
    expect(avgInterval).toBeLessThan(expectedInterval * 1.3);
  });

  it('returns empty beats for very short audio', () => {
    const sampleRate = 48000;
    const short = new Float32Array(2000);
    const buffer = createMockAudioBuffer([short], sampleRate);
    const result = trackBeats(buffer);

    expect(result.beats).toEqual([]);
    expect(result.bpm).toBe(120);
  });

  it('identifies downbeat position as one of the beat positions', () => {
    const buffer = createPulseTrainAudio(128, 8, 48000, true);
    const result = trackBeats(buffer, 128);

    // Downbeat should be one of the detected beats
    if (result.beats.length > 0) {
      expect(result.beats).toContain(result.downbeat);
    }
  });

  it('works without a tempo hint (auto-detects)', () => {
    const buffer = createPulseTrainAudio(128, 8);
    const result = trackBeats(buffer);

    expect(result.beats.length).toBeGreaterThan(5);
    expect(result.bpm).toBeGreaterThan(60);
    expect(result.bpm).toBeLessThan(200);
  });
});
