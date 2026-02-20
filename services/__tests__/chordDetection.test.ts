import { describe, expect, it } from 'vitest';
import { detectChords } from '../chordDetection';

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

function synthHarmonicChord(
  frequencies: number[],
  length: number,
  sampleRate: number,
  gain: number = 0.2,
): Float32Array {
  const output = new Float32Array(length);
  const attackSamples = Math.max(1, Math.floor(sampleRate * 0.01));
  const releaseSamples = Math.max(1, Math.floor(sampleRate * 0.02));

  for (let i = 0; i < length; i++) {
    let sample = 0;
    for (const frequency of frequencies) {
      const phase = (2 * Math.PI * frequency * i) / sampleRate;
      sample += Math.sin(phase) + 0.35 * Math.sin(phase * 2);
    }
    sample /= frequencies.length;

    let envelope = 1;
    if (i < attackSamples) envelope = i / attackSamples;
    const tail = length - i;
    if (tail < releaseSamples) envelope *= tail / releaseSamples;

    output[i] = sample * gain * envelope;
  }

  return output;
}

function createChordProgressionAudio(
  chordFrequencies: number[][],
  segmentSeconds: number,
  sampleRate: number = 48_000,
): AudioBuffer {
  const segmentLength = Math.floor(segmentSeconds * sampleRate);
  const totalLength = segmentLength * chordFrequencies.length;
  const channel = new Float32Array(totalLength);

  chordFrequencies.forEach((frequencies, index) => {
    const segment = synthHarmonicChord(frequencies, segmentLength, sampleRate);
    channel.set(segment, index * segmentLength);
  });

  return createMockAudioBuffer([channel], sampleRate);
}

const C_MAJOR = [261.63, 329.63, 392.0];
const G_MAJOR = [196.0, 246.94, 293.66];
const A_MINOR = [220.0, 261.63, 329.63];
const F_MAJOR = [174.61, 220.0, 261.63];

describe('detectChords', () => {
  it('returns an empty result for very short audio (< 1 second)', () => {
    const sampleRate = 48_000;
    const length = Math.floor(sampleRate * 0.5);
    const shortAudio = synthHarmonicChord(C_MAJOR, length, sampleRate);
    const buffer = createMockAudioBuffer([shortAudio], sampleRate);

    const result = detectChords(buffer);

    expect(result.chords).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('returns an empty result for silent audio', () => {
    const sampleRate = 48_000;
    const silentAudio = new Float32Array(sampleRate * 4);
    const buffer = createMockAudioBuffer([silentAudio], sampleRate);

    const result = detectChords(buffer, 1, 0.5);

    expect(result.chords).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it('returns chords with valid structure', () => {
    const buffer = createChordProgressionAudio(
      [C_MAJOR, G_MAJOR, A_MINOR, F_MAJOR],
      1,
    );

    const result = detectChords(buffer, 1, 1);

    expect(result.chords.length).toBeGreaterThan(0);
    for (const chord of result.chords) {
      expect(chord).toEqual(
        expect.objectContaining({
          timeRange: expect.any(String),
          chord: expect.any(String),
          root: expect.any(String),
          quality: expect.any(String),
          confidence: expect.any(Number),
        }),
      );
    }
  });

  it('keeps confidence values between 0 and 1', () => {
    const buffer = createChordProgressionAudio(
      [C_MAJOR, G_MAJOR, A_MINOR, F_MAJOR],
      1,
    );

    const result = detectChords(buffer, 1, 1);

    for (const chord of result.chords) {
      expect(chord.confidence).toBeGreaterThanOrEqual(0);
      expect(chord.confidence).toBeLessThanOrEqual(1);
    }
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('merges adjacent windows that map to the same chord', () => {
    const sampleRate = 48_000;
    const seconds = 8;
    const mono = synthHarmonicChord(C_MAJOR, sampleRate * seconds, sampleRate);
    const buffer = createMockAudioBuffer([mono], sampleRate);

    const windowSeconds = 2;
    const hopSeconds = 1;
    const windowSamples = Math.floor(windowSeconds * sampleRate);
    const hopSamples = Math.floor(hopSeconds * sampleRate);
    const rawWindowCount =
      Math.floor((buffer.length - windowSamples) / hopSamples) + 1;

    const result = detectChords(buffer, windowSeconds, hopSeconds);

    expect(rawWindowCount).toBeGreaterThan(1);
    expect(result.chords.length).toBeGreaterThan(0);
    expect(result.chords.length).toBeLessThan(rawWindowCount);
  });

  it('uses " – " as the progression summary separator', () => {
    const buffer = createChordProgressionAudio(
      [C_MAJOR, G_MAJOR, A_MINOR, F_MAJOR],
      1,
    );

    const result = detectChords(buffer, 1, 1);
    const uniqueInOrder = result.chords
      .map((entry) => entry.chord)
      .filter(
        (chord, index, all) => index === 0 || chord !== all[index - 1],
      );

    expect(uniqueInOrder.length).toBeGreaterThan(1);
    expect(result.progression).toContain(' – ');
    expect(result.progression.split(' – ').length).toBe(uniqueInOrder.length);
  });

  it('emits chord symbols with valid root notes and suffixes', () => {
    const validRoots = new Set([
      'C',
      'C#',
      'D',
      'D#',
      'E',
      'F',
      'F#',
      'G',
      'G#',
      'A',
      'A#',
      'B',
    ]);
    const validSuffixes = new Set([
      '',
      'm',
      '7',
      'maj7',
      'm7',
      'dim',
      'aug',
      'sus4',
      'sus2',
    ]);

    const buffer = createChordProgressionAudio(
      [C_MAJOR, G_MAJOR, A_MINOR, F_MAJOR],
      1,
    );
    const result = detectChords(buffer, 1, 1);

    expect(result.chords.length).toBeGreaterThan(0);
    for (const entry of result.chords) {
      const match = /^([A-G](?:#)?)(m|7|maj7|m7|dim|aug|sus4|sus2)?$/.exec(
        entry.chord,
      );
      expect(match).not.toBeNull();
      const root = match?.[1] ?? '';
      const suffix = match?.[2] ?? '';
      expect(validRoots.has(root)).toBe(true);
      expect(validSuffixes.has(suffix)).toBe(true);
      expect(validRoots.has(entry.root)).toBe(true);
    }
  });
});
