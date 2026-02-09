/**
 * Pitch Detection Engine — YIN Algorithm
 *
 * Detects monophonic pitch from an AudioBuffer and returns a list of
 * DetectedNote objects suitable for MIDI export. Uses the YIN autocorrelation
 * method (de Cheveigné & Kawahara 2002) running entirely client-side.
 */

import { DetectedNote, PitchDetectionResult } from '../types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** YIN threshold — lower = more selective (0.10–0.20 is typical) */
const YIN_THRESHOLD = 0.15;

/** Minimum fundamental frequency we'll detect (Hz) */
const MIN_FREQUENCY = 50; // ~G1

/** Maximum fundamental frequency we'll detect (Hz) */
const MAX_FREQUENCY = 2000; // ~B6

/** Minimum note duration to keep (seconds) — filters spurious blips */
const MIN_NOTE_DURATION = 0.03;

/** Frame hop size in samples (controls time resolution) */
const HOP_SIZE = 512;

/** FFT/analysis window size */
const WINDOW_SIZE = 2048;

/** RMS silence threshold — frames below this are treated as silence */
const SILENCE_THRESHOLD = 0.01;

/** Maximum gap (seconds) to bridge when merging notes at the same pitch */
const MERGE_GAP = 0.04;

/** Minimum pitch change (semitones) to consider a new note vs continuation */
const PITCH_CHANGE_THRESHOLD = 0.5;

// ── Note name helpers ──────────────────────────────────────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  const name = NOTE_NAMES[rounded % 12];
  return `${name}${octave}`;
}

// ── YIN core ───────────────────────────────────────────────────────────────────

/**
 * Compute the YIN cumulative mean normalized difference function for a single
 * frame and return the estimated fundamental frequency (or -1 if unvoiced).
 */
function yinDetectPitch(
  samples: Float32Array,
  sampleRate: number,
): { frequency: number; confidence: number } {
  const halfWindow = Math.floor(samples.length / 2);

  // Step 1+2: Difference function + cumulative mean normalization
  const yinBuffer = new Float32Array(halfWindow);
  yinBuffer[0] = 1; // by definition

  let runningSum = 0;

  for (let tau = 1; tau < halfWindow; tau++) {
    let diff = 0;
    for (let i = 0; i < halfWindow; i++) {
      const delta = samples[i] - samples[i + tau];
      diff += delta * delta;
    }
    yinBuffer[tau] = diff;
    runningSum += diff;
    yinBuffer[tau] *= tau / runningSum;
  }

  // Step 3: Absolute threshold — find first dip below threshold
  const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxTau = Math.min(halfWindow - 1, Math.floor(sampleRate / MIN_FREQUENCY));

  let bestTau = -1;

  for (let tau = minTau; tau < maxTau; tau++) {
    if (yinBuffer[tau] < YIN_THRESHOLD) {
      // Walk forward while still decreasing to find the true minimum
      while (tau + 1 < maxTau && yinBuffer[tau + 1] < yinBuffer[tau]) {
        tau++;
      }
      bestTau = tau;
      break;
    }
  }

  if (bestTau === -1) {
    return { frequency: -1, confidence: 0 };
  }

  // Step 4: Parabolic interpolation around bestTau for sub-sample accuracy
  const s0 = yinBuffer[bestTau - 1] ?? yinBuffer[bestTau];
  const s1 = yinBuffer[bestTau];
  const s2 = yinBuffer[bestTau + 1] ?? yinBuffer[bestTau];
  const shift = (s0 - s2) / (2 * (s0 - 2 * s1 + s2) || 1);
  const refinedTau = bestTau + shift;

  const frequency = sampleRate / refinedTau;
  const confidence = 1 - (s1 < 0 ? 0 : s1); // lower YIN value = higher confidence

  return { frequency, confidence: Math.max(0, Math.min(1, confidence)) };
}

// ── Frame-level detection ──────────────────────────────────────────────────────

interface RawDetection {
  time: number;
  frequency: number;
  midi: number;
  confidence: number;
  rms: number;
}

function detectFrames(audioBuffer: AudioBuffer): RawDetection[] {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // mono
  const totalSamples = channelData.length;

  const detections: RawDetection[] = [];

  for (let offset = 0; offset + WINDOW_SIZE <= totalSamples; offset += HOP_SIZE) {
    const frame = channelData.slice(offset, offset + WINDOW_SIZE);

    // RMS for this frame → velocity / silence gate
    let rmsSum = 0;
    for (let i = 0; i < frame.length; i++) {
      rmsSum += frame[i] * frame[i];
    }
    const rms = Math.sqrt(rmsSum / frame.length);

    if (rms < SILENCE_THRESHOLD) continue; // silence

    const { frequency, confidence } = yinDetectPitch(frame, sampleRate);

    if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) continue;

    const midi = frequencyToMidi(frequency);

    detections.push({
      time: offset / sampleRate,
      frequency,
      midi,
      confidence,
      rms,
    });
  }

  return detections;
}

// ── Note segmentation ──────────────────────────────────────────────────────────

/**
 * Group consecutive frame detections into discrete notes.
 * Adjacent frames at (approximately) the same pitch are merged.
 */
function segmentNotes(detections: RawDetection[], maxRms: number): DetectedNote[] {
  if (detections.length === 0) return [];

  const notes: DetectedNote[] = [];
  let noteStart = detections[0];
  let noteEnd = detections[0];
  let peakRms = detections[0].rms;
  let confidenceSum = detections[0].confidence;
  let frameCount = 1;

  for (let i = 1; i < detections.length; i++) {
    const prev = detections[i - 1];
    const curr = detections[i];

    const pitchChange = Math.abs(curr.midi - prev.midi);
    const timeGap = curr.time - prev.time;

    // Same note if pitch is similar and there's no large time gap
    if (pitchChange < PITCH_CHANGE_THRESHOLD && timeGap < MERGE_GAP + 0.06) {
      noteEnd = curr;
      peakRms = Math.max(peakRms, curr.rms);
      confidenceSum += curr.confidence;
      frameCount++;
    } else {
      // Finalize previous note
      const duration = noteEnd.time - noteStart.time + (HOP_SIZE / 44100);
      if (duration >= MIN_NOTE_DURATION) {
        const roundedMidi = Math.round(
          (detections.slice(
            detections.indexOf(noteStart),
            detections.indexOf(noteEnd) + 1,
          ).reduce((s, d) => s + d.midi, 0)) / frameCount,
        );
        notes.push({
          midi: Math.max(0, Math.min(127, roundedMidi)),
          name: midiToNoteName(roundedMidi),
          frequency: noteStart.frequency,
          startTime: noteStart.time,
          duration,
          velocity: Math.max(1, Math.min(127, Math.round((peakRms / (maxRms || 1)) * 127))),
          confidence: confidenceSum / frameCount,
        });
      }

      // Start new note
      noteStart = curr;
      noteEnd = curr;
      peakRms = curr.rms;
      confidenceSum = curr.confidence;
      frameCount = 1;
    }
  }

  // Finalize last note
  const duration = noteEnd.time - noteStart.time + (HOP_SIZE / 44100);
  if (duration >= MIN_NOTE_DURATION) {
    const roundedMidi = Math.round(
      (detections.slice(
        detections.indexOf(noteStart),
        detections.indexOf(noteEnd) + 1,
      ).reduce((s, d) => s + d.midi, 0)) / frameCount,
    );
    notes.push({
      midi: Math.max(0, Math.min(127, roundedMidi)),
      name: midiToNoteName(roundedMidi),
      frequency: noteStart.frequency,
      startTime: noteStart.time,
      duration,
      velocity: Math.max(1, Math.min(127, Math.round((peakRms / (maxRms || 1)) * 127))),
      confidence: confidenceSum / frameCount,
    });
  }

  return notes;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Detect pitches from an AudioBuffer and return structured note data.
 *
 * @param audioBuffer - Decoded audio (from `decodeAudioFile`)
 * @param bpm - Detected BPM (passed through for downstream quantization)
 */
export async function detectPitches(
  audioBuffer: AudioBuffer,
  bpm: number = 120,
): Promise<PitchDetectionResult> {
  // Run frame-level YIN detection
  const detections = detectFrames(audioBuffer);

  // Find peak RMS for velocity normalization
  const maxRms = detections.reduce((max, d) => Math.max(max, d.rms), 0);

  // Segment into discrete notes
  const notes = segmentNotes(detections, maxRms);

  // Overall confidence = mean of note confidences
  const avgConfidence =
    notes.length > 0
      ? notes.reduce((s, n) => s + n.confidence, 0) / notes.length
      : 0;

  return {
    notes,
    confidence: avgConfidence,
    duration: audioBuffer.duration,
    bpm,
  };
}
