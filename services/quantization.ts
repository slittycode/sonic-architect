/**
 * Note Quantization Service
 *
 * Snaps detected note start-times and durations to a rhythmic grid.
 * Supports standard subdivisions (1/4, 1/8, 1/16, 1/32) and swing.
 */

import { DetectedNote, QuantizeGrid, QuantizeOptions } from '../types';

/**
 * Convert a grid value to its duration in seconds at the given BPM.
 */
function gridToSeconds(grid: QuantizeGrid, bpm: number): number {
  const beatDuration = 60 / bpm; // quarter note in seconds
  switch (grid) {
    case '1/4':
      return beatDuration;
    case '1/8':
      return beatDuration / 2;
    case '1/16':
      return beatDuration / 4;
    case '1/32':
      return beatDuration / 8;
    case 'off':
      return 0;
  }
}

/**
 * Snap a time value to the nearest grid position, with optional swing.
 *
 * Swing shifts every *other* grid position forward by a percentage of the
 * grid interval. 0 = straight, 50 = triplet feel, 100 = dotted feel.
 */
function snapToGrid(time: number, gridSize: number, swing: number): number {
  if (gridSize <= 0) return time;

  const gridIndex = Math.round(time / gridSize);
  let snapped = gridIndex * gridSize;

  // Apply swing to odd grid positions
  if (swing > 0 && gridIndex % 2 !== 0) {
    const swingOffset = (swing / 100) * gridSize * 0.5;
    snapped += swingOffset;
  }

  return snapped;
}

/**
 * Snap a duration to the nearest grid multiple (minimum = half a grid cell).
 */
function snapDuration(duration: number, gridSize: number): number {
  if (gridSize <= 0) return duration;
  const minDuration = gridSize / 2;
  const snapped = Math.max(minDuration, Math.round(duration / gridSize) * gridSize);
  return snapped;
}

/**
 * Quantize an array of detected notes to the specified grid & swing.
 * Returns a new array (does not mutate the input).
 */
export function quantizeNotes(
  notes: DetectedNote[],
  bpm: number,
  options: QuantizeOptions
): DetectedNote[] {
  if (options.grid === 'off') return notes;

  const gridSize = gridToSeconds(options.grid, bpm);

  return notes.map((note) => ({
    ...note,
    startTime: snapToGrid(note.startTime, gridSize, options.swing),
    duration: snapDuration(note.duration, gridSize),
  }));
}

/**
 * Get human-readable label for a grid value.
 */
export function gridLabel(grid: QuantizeGrid): string {
  switch (grid) {
    case '1/4':
      return '¼ note';
    case '1/8':
      return '⅛ note';
    case '1/16':
      return '1/16 note';
    case '1/32':
      return '1/32 note';
    case 'off':
      return 'Off';
  }
}
