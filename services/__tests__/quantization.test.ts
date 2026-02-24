import { describe, it, expect } from 'vitest';
import { quantizeNotes } from '../quantization';
import { DetectedNote } from '../../types';

describe('quantization', () => {
  it('returns notes unchanged when gridSize is off', () => {
    const notes: DetectedNote[] = [
      {
        midi: 60,
        name: 'C4',
        frequency: 261.63,
        startTime: 0.123,
        duration: 0.5,
        velocity: 100,
        confidence: 1,
      },
    ];
    const result = quantizeNotes(notes, 120, { grid: 'off', swing: 0 });
    expect(result[0].startTime).toBe(0.123);
    expect(result[0].duration).toBe(0.5);
  });

  it('snaps to the nearest 1/4 note boundary at 120 BPM', () => {
    // at 120 BPM, 1/4 note is 0.5 seconds
    const notes: DetectedNote[] = [
      {
        midi: 60,
        name: 'C4',
        frequency: 261.63,
        startTime: 0.49,
        duration: 0.51,
        velocity: 100,
        confidence: 1,
      },
      {
        midi: 62,
        name: 'D4',
        frequency: 293.66,
        startTime: 1.05,
        duration: 0.4,
        velocity: 100,
        confidence: 1,
      },
    ];
    const result = quantizeNotes(notes, 120, { grid: '1/4', swing: 0 });

    expect(result[0].startTime).toBe(0.5);
    // Duration snaps to nearest grid multiple (minimum half grid cell = 0.25)
    // 0.51 -> snaps to 0.5
    expect(result[0].duration).toBe(0.5);

    expect(result[1].startTime).toBe(1.0);
    // 0.4 -> snaps to 0.5 (nearest multiple of grid size 0.5 is 0.5)
    expect(result[1].duration).toBe(0.5);
  });
});
