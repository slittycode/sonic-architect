/**
 * Polyphonic Pitch Detection — Spotify Basic Pitch
 *
 * Wraps @spotify/basic-pitch for browser-based polyphonic audio-to-MIDI.
 * Uses dynamic import so the TF.js runtime + model (~900KB) only loads
 * when polyphonic detection is explicitly requested.
 *
 * Falls back to the existing YIN monophonic detector if Basic Pitch
 * cannot initialise (e.g. WebGL unavailable).
 */

import { DetectedNote, PitchDetectionResult } from '../types';

// ── Note helpers (shared with pitchDetection.ts) ─────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[rounded % 12]}${octave}`;
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── Lazy-loaded Basic Pitch singleton ────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let basicPitchInstance: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadPromise: Promise<any> | null = null;

/** Resolve model URL. Extracted so tests can mock the module without URL issues. */
function getModelURL(): string {
  return new URL(
    '../node_modules/@spotify/basic-pitch/model/model.json',
    import.meta.url
  ).href;
}

async function getBasicPitch() {
  if (basicPitchInstance) return basicPitchInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { BasicPitch } = await import('@spotify/basic-pitch');
    const instance = new BasicPitch(getModelURL());
    basicPitchInstance = instance;
    return instance;
  })();

  return loadPromise;
}

/** Reset the cached instance (for testing). */
export function _resetInstance(): void {
  basicPitchInstance = null;
  loadPromise = null;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface PolyphonicOptions {
  /** Onset detection threshold (0–1). Lower = more sensitive. Default: 0.5 */
  onsetThreshold?: number;
  /** Frame activation threshold (0–1). Lower = more notes. Default: 0.3 */
  frameThreshold?: number;
  /** Minimum note length in MIDI frames (~11.6ms each). Default: 5 */
  minNoteLength?: number;
  /** Progress callback (0–1). */
  onProgress?: (percent: number) => void;
}

/**
 * Detect polyphonic pitches using Spotify Basic Pitch.
 *
 * Returns the same PitchDetectionResult shape as the YIN monophonic detector,
 * so the rest of the pipeline (quantisation, MIDI export, preview) works unchanged.
 */
export async function detectPolyphonic(
  audioBuffer: AudioBuffer,
  bpm: number = 120,
  options: PolyphonicOptions = {}
): Promise<PitchDetectionResult> {
  const {
    onsetThreshold = 0.5,
    frameThreshold = 0.3,
    minNoteLength = 5,
    onProgress,
  } = options;

  const bp = await getBasicPitch();

  // Basic Pitch expects mono Float32Array or AudioBuffer.
  // Evaluate the model — returns frames, onsets, contours via callback.
  let framesResult: number[][] = [];
  let onsetsResult: number[][] = [];
  let contoursResult: number[][] = [];

  await bp.evaluateModel(
    audioBuffer,
    (frames, onsets, contours) => {
      framesResult = frames;
      onsetsResult = onsets;
      contoursResult = contours;
    },
    (percent) => {
      onProgress?.(percent);
    }
  );

  // Import post-processing functions
  const { outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import(
    '@spotify/basic-pitch'
  );

  // Convert raw model output to note events
  let noteEvents = outputToNotesPoly(
    framesResult,
    onsetsResult,
    onsetThreshold,
    frameThreshold,
    minNoteLength,
    true, // inferOnsets — improves onset detection
    null, // maxFreq
    null, // minFreq
    true, // melodiaTrick — Gaussian onset spreading
    11 // energyTolerance
  );

  // Add pitch bend information from contours
  noteEvents = addPitchBendsToNoteEvents(contoursResult, noteEvents);

  // Convert frame-based timing to seconds
  const noteTimes = noteFramesToTime(noteEvents);

  // Map to our DetectedNote format
  const notes: DetectedNote[] = noteTimes.map((n) => {
    const midi = Math.max(0, Math.min(127, Math.round(n.pitchMidi)));
    return {
      midi,
      name: midiToNoteName(midi),
      frequency: midiToHz(midi),
      startTime: n.startTimeSeconds,
      duration: n.durationSeconds,
      velocity: Math.max(1, Math.min(127, Math.round(n.amplitude * 127))),
      confidence: n.amplitude, // Basic Pitch amplitude ≈ confidence proxy
    };
  });

  // Sort by start time
  notes.sort((a, b) => a.startTime - b.startTime);

  const avgConfidence =
    notes.length > 0 ? notes.reduce((s, n) => s + n.confidence, 0) / notes.length : 0;

  return {
    notes,
    confidence: avgConfidence,
    duration: audioBuffer.duration,
    bpm,
  };
}

/**
 * Check whether Basic Pitch can be loaded in this environment.
 * Returns false if TF.js / WebGL is unavailable.
 */
export async function isPolyphonicAvailable(): Promise<boolean> {
  try {
    await getBasicPitch();
    return true;
  } catch {
    return false;
  }
}
