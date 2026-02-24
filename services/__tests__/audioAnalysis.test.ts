import { describe, expect, it } from 'vitest';
import { extractWaveformPeaks } from '../audioAnalysis';

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

describe('extractWaveformPeaks', () => {
  it('returns normalized peaks and preserves macro dynamics', () => {
    const sampleRate = 48000;
    const length = sampleRate;
    const channel = new Float32Array(length);

    // First half quiet, second half loud.
    for (let i = 0; i < length; i++) {
      const base = Math.sin((2 * Math.PI * 220 * i) / sampleRate);
      const gain = i < length / 2 ? 0.2 : 0.9;
      channel[i] = base * gain;
    }

    const buffer = createMockAudioBuffer([channel], sampleRate);
    const peaks = extractWaveformPeaks(buffer, 64);

    expect(peaks).toHaveLength(64);
    expect(Math.max(...peaks)).toBeCloseTo(1, 5);

    const firstHalfAvg = peaks.slice(0, 32).reduce((sum, value) => sum + value, 0) / 32;
    const secondHalfAvg = peaks.slice(32).reduce((sum, value) => sum + value, 0) / 32;

    expect(secondHalfAvg).toBeGreaterThan(firstHalfAvg);
  });
});
