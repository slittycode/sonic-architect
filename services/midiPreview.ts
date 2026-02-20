/**
 * MIDI Preview Playback
 *
 * Uses the Web Audio API to synthesise a simple preview of detected notes
 * via oscillators. This lets users audition the transcription before
 * downloading the .mid file.
 */

import { DetectedNote } from '../types';

/** Convert MIDI note number to frequency (A4 = 440 Hz) */
function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Controller for stopping an in-progress preview.
 */
export interface PreviewHandle {
  /** Stop playback immediately */
  stop(): void;
  /** Whether playback is still active */
  readonly playing: boolean;
}

/**
 * Play a preview of detected notes through Web Audio oscillators.
 *
 * Each note is rendered as a simple sine/triangle oscillator with an
 * amplitude envelope for a clean piano-like attack/release.
 *
 * @param notes   Notes to preview (will be sorted by startTime)
 * @param bpm     Tempo (used for display context, not yet for quantized playback)
 * @param onEnd   Callback when playback finishes naturally
 * @returns A handle to stop playback
 */
export function previewNotes(
  notes: DetectedNote[],
  _bpm: number = 120,
  onEnd?: () => void
): PreviewHandle {
  const ctx = new AudioContext();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.35; // prevent clipping with many notes
  masterGain.connect(ctx.destination);

  let isPlaying = true;
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  // Schedule each note
  const endTimes: number[] = [];

  for (const note of sorted) {
    const freq = midiToFrequency(note.midi);
    const start = ctx.currentTime + note.startTime;
    const dur = Math.max(0.05, note.duration);
    const end = start + dur;
    endTimes.push(end);

    // Oscillator
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    // Envelope
    const env = ctx.createGain();
    const velocity = note.velocity / 127;
    const attackTime = 0.01;
    const releaseTime = Math.min(0.08, dur * 0.3);

    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(velocity * 0.6, start + attackTime);
    env.gain.setValueAtTime(velocity * 0.6, end - releaseTime);
    env.gain.linearRampToValueAtTime(0, end);

    osc.connect(env);
    env.connect(masterGain);

    osc.start(start);
    osc.stop(end + 0.01);
  }

  // Determine total duration and fire onEnd when done
  const lastEnd = endTimes.length > 0 ? Math.max(...endTimes) : ctx.currentTime;
  const totalDuration = (lastEnd - ctx.currentTime) * 1000 + 100;

  const timeoutId = setTimeout(() => {
    isPlaying = false;
    ctx.close();
    onEnd?.();
  }, totalDuration);

  return {
    stop() {
      if (!isPlaying) return;
      isPlaying = false;
      clearTimeout(timeoutId);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
      setTimeout(() => ctx.close(), 100);
      onEnd?.();
    },
    get playing() {
      return isPlaying;
    },
  };
}
