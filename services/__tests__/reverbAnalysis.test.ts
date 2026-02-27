import { describe, it, expect } from 'vitest';
import { analyzeReverb } from '../reverbAnalysis';

function createMockAudioBuffer(channels: Float32Array[], sampleRate: number): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    sampleRate,
    numberOfChannels: channels.length,
    length,
    duration: sampleRate > 0 ? length / sampleRate : 0,
    getChannelData: (index: number) => channels[index] ?? new Float32Array(0),
  } as unknown as AudioBuffer;
}

/**
 * Creates a buffer with sharp transients followed by a very short decay (dry signal).
 * Decay is exponential with a fast time constant.
 */
function createDryBuffer(sampleRate = 44100, bpm = 120, numHits = 6): AudioBuffer {
  const beatInterval = (60 / bpm) * sampleRate;
  const totalSamples = Math.ceil(beatInterval * (numHits + 1));
  const data = new Float32Array(totalSamples);

  for (let k = 0; k < numHits; k++) {
    const hitStart = Math.round(k * beatInterval);
    const decayLen = Math.min(441, totalSamples - hitStart); // ~10ms fast decay
    for (let i = 0; i < decayLen; i++) {
      const t = i / sampleRate;
      data[hitStart + i] = Math.exp(-t * 200) * Math.sin(2 * Math.PI * 440 * t);
    }
  }
  return createMockAudioBuffer([data], sampleRate);
}

/**
 * Creates a buffer with transients followed by long reverb tails (wet signal).
 * Decay is slow, simulating a long room reverb.
 */
function createWetBuffer(sampleRate = 44100, bpm = 90, numHits = 5): AudioBuffer {
  const beatInterval = (60 / bpm) * sampleRate;
  const totalSamples = Math.ceil(beatInterval * (numHits + 1));
  const data = new Float32Array(totalSamples);

  for (let k = 0; k < numHits; k++) {
    const hitStart = Math.round(k * beatInterval);
    const decayLen = Math.min(Math.floor(beatInterval * 0.8), totalSamples - hitStart);
    for (let i = 0; i < decayLen; i++) {
      const t = i / sampleRate;
      // Very slow decay simulating long reverb tail
      data[hitStart + i] = Math.exp(-t * 3) * Math.sin(2 * Math.PI * 440 * t);
    }
  }
  return createMockAudioBuffer([data], sampleRate);
}

describe('analyzeReverb', () => {
  it('returns a valid ReverbAnalysisResult object', () => {
    const buffer = createDryBuffer();
    const result = analyzeReverb(buffer, 120);

    expect(result).toHaveProperty('rt60');
    expect(result).toHaveProperty('isWet');
    expect(result).toHaveProperty('tailEnergyRatio');
  });

  it('returns rt60 >= 0 and <= 3 (capped)', () => {
    const buffer = createWetBuffer();
    const result = analyzeReverb(buffer, 90);

    expect(result.rt60).toBeGreaterThanOrEqual(0);
    expect(result.rt60).toBeLessThanOrEqual(3);
  });

  it('isWet is a boolean', () => {
    const buffer = createDryBuffer();
    const result = analyzeReverb(buffer, 120);
    expect(typeof result.isWet).toBe('boolean');
  });

  it('returns tailEnergyRatio in [0, 1] range', () => {
    const buffer = createWetBuffer();
    const result = analyzeReverb(buffer, 90);

    expect(result.tailEnergyRatio).toBeGreaterThanOrEqual(0);
    expect(result.tailEnergyRatio).toBeLessThanOrEqual(1);
  });

  it('returns safe defaults for very short audio (< 20 envelope frames)', () => {
    const short = createMockAudioBuffer([new Float32Array(440)], 44100);
    const result = analyzeReverb(short, 120);

    expect(result.rt60).toBeGreaterThanOrEqual(0);
    expect(result.rt60).toBeLessThanOrEqual(3);
    expect(result.isWet).toBe(false);
  });

  it('returns safe defaults for silence (no transients detected)', () => {
    const silent = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = analyzeReverb(silent, 120);

    expect(result.rt60).toBeGreaterThanOrEqual(0);
    expect(result.isWet).toBe(false);
  });

  it('classifies dry buffer as isWet: false', () => {
    const result = analyzeReverb(createDryBuffer(), 120);
    expect(result.isWet).toBe(false);
  });

  it('classifies wet buffer as isWet: true', () => {
    const result = analyzeReverb(createWetBuffer(), 90);
    expect(result.isWet).toBe(true);
  });

  it('returns higher rt60 for wet buffer than dry buffer', () => {
    const dry = analyzeReverb(createDryBuffer(), 120);
    const wet = analyzeReverb(createWetBuffer(), 90);
    expect(wet.rt60).toBeGreaterThan(dry.rt60);
  });
});
