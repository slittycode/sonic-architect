import { describe, it, expect } from 'vitest';
import { separateHarmonicPercussive, wrapAsAudioBuffer } from '../hpss';

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

/** Create a sustained sine tone (should be classified as harmonic). */
function createSineBuffer(
  frequency: number = 440,
  durationSec: number = 2,
  sampleRate: number = 44100
): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    data[i] = 0.8 * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return createMockAudioBuffer([data], sampleRate);
}

/** Create a click train (should be classified as percussive). */
function createClickBuffer(
  clicksPerSecond: number = 4,
  durationSec: number = 2,
  sampleRate: number = 44100
): AudioBuffer {
  const length = Math.floor(sampleRate * durationSec);
  const data = new Float32Array(length);
  const clickInterval = Math.floor(sampleRate / clicksPerSecond);
  const clickLength = Math.floor(sampleRate * 0.002); // 2ms click

  for (let pos = 0; pos < length; pos += clickInterval) {
    for (let i = 0; i < clickLength && pos + i < length; i++) {
      data[pos + i] = 0.9 * Math.exp((-10 * i) / clickLength);
    }
  }
  return createMockAudioBuffer([data], sampleRate);
}

function rmsEnergy(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / data.length);
}

describe('HPSS', () => {
  it('returns harmonic and percussive arrays of correct length', () => {
    const buffer = createSineBuffer(440, 1);
    const result = separateHarmonicPercussive(buffer);

    expect(result.harmonic).toBeInstanceOf(Float32Array);
    expect(result.percussive).toBeInstanceOf(Float32Array);
    expect(result.harmonic.length).toBeGreaterThan(0);
    expect(result.percussive.length).toBeGreaterThan(0);
    expect(result.sampleRate).toBe(44100);
  });

  it('puts most energy of a pure sine into the harmonic component', () => {
    const buffer = createSineBuffer(440, 2);
    const result = separateHarmonicPercussive(buffer);

    const harmonicRms = rmsEnergy(result.harmonic);
    const percussiveRms = rmsEnergy(result.percussive);

    // Harmonic should contain significantly more energy than percussive
    expect(harmonicRms).toBeGreaterThan(percussiveRms * 2);
  });

  it('puts most energy of a click train into the percussive component', () => {
    const buffer = createClickBuffer(8, 2);
    const result = separateHarmonicPercussive(buffer);

    const harmonicRms = rmsEnergy(result.harmonic);
    const percussiveRms = rmsEnergy(result.percussive);

    // Percussive should contain significantly more energy than harmonic
    expect(percussiveRms).toBeGreaterThan(harmonicRms * 1.5);
  });

  it('total energy is approximately conserved', () => {
    const buffer = createSineBuffer(440, 2);
    const input = buffer.getChannelData(0);
    const result = separateHarmonicPercussive(buffer);

    // Input energy
    const inputRms = rmsEnergy(input);
    // Sum of H + P energy (approximate due to soft masking)
    const totalOutput = Math.sqrt(
      rmsEnergy(result.harmonic) ** 2 + rmsEnergy(result.percussive) ** 2
    );

    // Should be within 50% of input (soft masking doesn't perfectly conserve)
    expect(totalOutput).toBeGreaterThan(inputRms * 0.3);
    expect(totalOutput).toBeLessThan(inputRms * 1.5);
  });

  it('wrapAsAudioBuffer creates a valid AudioBuffer-like object', () => {
    const data = new Float32Array(1000);
    const wrapped = wrapAsAudioBuffer(data, 44100);

    expect(wrapped.sampleRate).toBe(44100);
    expect(wrapped.numberOfChannels).toBe(1);
    expect(wrapped.length).toBe(1000);
    expect(wrapped.getChannelData(0)).toBe(data);
  });
});
