import { describe, it, expect } from 'vitest';
import { createMidiFile } from '../midiExport';
import { DetectedNote } from '../../types';

describe('midiExport', () => {
  it('returns a Blob given a valid array of DetectedNote objects', () => {
    const notes: DetectedNote[] = [
      {
        midi: 60,
        name: 'C4',
        frequency: 261.63,
        startTime: 0,
        duration: 0.5,
        velocity: 100,
        confidence: 1,
      },
      {
        midi: 62,
        name: 'D4',
        frequency: 293.66,
        startTime: 0.5,
        duration: 0.5,
        velocity: 100,
        confidence: 1,
      },
    ];

    const result = createMidiFile(notes);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('audio/midi');
  });
});
