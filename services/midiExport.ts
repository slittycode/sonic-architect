/**
 * MIDI Export Service
 *
 * Converts DetectedNote[] into a standard MIDI file using midi-writer-js.
 * Produces a downloadable .mid Blob.
 */

import MidiWriter from 'midi-writer-js';
import { DetectedNote } from '../types';

/** Ticks per quarter note (midi-writer-js default = 128) */
const TICKS_PER_BEAT = 128;

/**
 * Convert a MIDI note number to the pitch string midi-writer-js expects.
 * e.g. 60 → 'C4', 61 → 'C#4'
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function midiToPitchString(midi: number): string {
  const clamped = Math.max(0, Math.min(127, Math.round(midi)));
  const octave = Math.floor(clamped / 12) - 1;
  const note = NOTE_NAMES[clamped % 12];
  return `${note}${octave}`;
}

/**
 * Convert a duration in seconds to a tick string (e.g. "T256").
 */
function durationToTicks(durationSec: number, bpm: number): number {
  const beatsPerSecond = bpm / 60;
  const beats = durationSec * beatsPerSecond;
  return Math.max(1, Math.round(beats * TICKS_PER_BEAT));
}

/**
 * Create a MIDI file from detected notes.
 *
 * @returns A Blob containing a valid .mid file
 */
export function createMidiFile(notes: DetectedNote[], bpm: number = 120): Blob {
  const track = new MidiWriter.Track();

  // Set metadata
  track.setTempo(bpm);
  track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: 1 })); // Acoustic Piano

  // Sort notes by start time
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  // Add notes with absolute tick positioning
  for (const note of sorted) {
    const startTick = durationToTicks(note.startTime, bpm);
    const durTicks = durationToTicks(note.duration, bpm);

    // Velocity: midi-writer-js uses 1-100 scale
    const velocity = Math.max(1, Math.min(100, Math.round((note.velocity / 127) * 100)));

    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [midiToPitchString(note.midi)],
        duration: `T${durTicks}`,
        velocity,
        startTick,
      })
    );
  }

  const writer = new MidiWriter.Writer([track]);
  const uint8 = writer.buildFile();

  return new Blob([uint8.buffer as ArrayBuffer], { type: 'audio/midi' });
}

/**
 * Trigger a browser download of a MIDI file.
 */
export function downloadMidiFile(
  notes: DetectedNote[],
  bpm: number,
  fileName: string = 'session-musician.mid'
): void {
  const blob = createMidiFile(notes, bpm);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
