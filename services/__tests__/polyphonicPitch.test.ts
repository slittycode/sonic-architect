import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests for the polyphonic pitch detection wrapper.
 *
 * Since Basic Pitch requires TF.js (WebGL), we mock the @spotify/basic-pitch
 * module entirely and verify our mapping logic: NoteEventTime → DetectedNote.
 */

// Canned note events that outputToNotesPoly "produces"
const mockNoteEvents = [
  { startFrame: 10, durationFrames: 20, pitchMidi: 60, amplitude: 0.8 },
  { startFrame: 15, durationFrames: 15, pitchMidi: 64, amplitude: 0.6 },
  { startFrame: 30, durationFrames: 10, pitchMidi: 67, amplitude: 0.7 },
];

// noteFramesToTime converts frame indices to seconds (~11.6ms per frame)
const mockNoteTimes = [
  { startTimeSeconds: 0.116, durationSeconds: 0.232, pitchMidi: 60, amplitude: 0.8 },
  { startTimeSeconds: 0.174, durationSeconds: 0.174, pitchMidi: 64, amplitude: 0.6 },
  { startTimeSeconds: 0.348, durationSeconds: 0.116, pitchMidi: 67, amplitude: 0.7 },
];

// Mock the @spotify/basic-pitch module before importing our wrapper
vi.mock('@spotify/basic-pitch', () => {
  // Must use a real class for `new BasicPitch(...)` to work
  class MockBasicPitch {
    async evaluateModel(
      _buffer: unknown,
      onComplete: (f: number[][], o: number[][], c: number[][]) => void,
      percentCb: (p: number) => void
    ) {
      percentCb(0.5);
      percentCb(1.0);
      onComplete([[0.8, 0.1]], [[0.9, 0.0]], [[0.5, 0.2]]);
    }
  }

  return {
    BasicPitch: MockBasicPitch,
    outputToNotesPoly: vi.fn().mockReturnValue(mockNoteEvents),
    addPitchBendsToNoteEvents: vi.fn().mockImplementation((_c: unknown, notes: unknown) => notes),
    noteFramesToTime: vi.fn().mockReturnValue(mockNoteTimes),
  };
});

// Now import the module under test (uses the mock above)
import { detectPolyphonic, _resetInstance } from '../polyphonicPitch';

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

describe('polyphonicPitch (Basic Pitch wrapper)', () => {
  beforeEach(() => {
    _resetInstance();
    vi.clearAllMocks();
  });

  it('returns DetectedNote array from Basic Pitch output', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = await detectPolyphonic(buffer, 120);

    expect(result.notes.length).toBe(3);
    expect(result.bpm).toBe(120);
    expect(result.duration).toBe(1);
  });

  it('maps pitchMidi to correct note names', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = await detectPolyphonic(buffer, 120);

    // MIDI 60 = C4, 64 = E4, 67 = G4 (C major triad)
    expect(result.notes[0].name).toBe('C4');
    expect(result.notes[0].midi).toBe(60);

    expect(result.notes[1].name).toBe('E4');
    expect(result.notes[1].midi).toBe(64);

    expect(result.notes[2].name).toBe('G4');
    expect(result.notes[2].midi).toBe(67);
  });

  it('maps amplitude to velocity (0–127 range)', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = await detectPolyphonic(buffer, 120);

    for (const note of result.notes) {
      expect(note.velocity).toBeGreaterThanOrEqual(1);
      expect(note.velocity).toBeLessThanOrEqual(127);
    }

    // amplitude 0.8 → velocity ~102
    expect(result.notes[0].velocity).toBe(Math.round(0.8 * 127));
  });

  it('sorts notes by start time', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = await detectPolyphonic(buffer, 120);

    for (let i = 1; i < result.notes.length; i++) {
      expect(result.notes[i].startTime).toBeGreaterThanOrEqual(result.notes[i - 1].startTime);
    }
  });

  it('computes average confidence from amplitudes', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const result = await detectPolyphonic(buffer, 120);

    // Mean of [0.8, 0.6, 0.7] = 0.7
    expect(result.confidence).toBeCloseTo(0.7, 1);
  });

  it('calls progress callback', async () => {
    const buffer = createMockAudioBuffer([new Float32Array(44100)], 44100);
    const progressValues: number[] = [];
    await detectPolyphonic(buffer, 120, {
      onProgress: (p) => progressValues.push(p),
    });

    expect(progressValues.length).toBeGreaterThan(0);
    expect(progressValues).toContain(1.0);
  });
});
