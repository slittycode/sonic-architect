/**
 * Chord Detection via Windowed Chroma Template Matching
 *
 * Algorithm:
 * 1. Divide audio into overlapping windows
 * 2. Compute chroma features per window (Goertzel algorithm)
 * 3. Correlate each chroma window against chord templates
 * 4. Return the best-matching chord per window with confidence
 *
 * Supports: Major, Minor, Diminished, Augmented, Dominant 7th, Major 7th, Minor 7th
 */

export interface DetectedChord {
  /** Time range string, e.g. "0:04–0:08" */
  timeRange: string;
  /** Chord symbol, e.g. "Am", "F", "Cmaj7" */
  chord: string;
  /** Root note name */
  root: string;
  /** Chord quality */
  quality: string;
  /** Detection confidence 0-1 */
  confidence: number;
}

export interface ChordProgressionResult {
  /** Ordered list of detected chords */
  chords: DetectedChord[];
  /** Simplified progression string, e.g. "Am – F – C – G" */
  progression: string;
  /** Overall detection confidence */
  confidence: number;
}

// ── Note names ───────────────────────────────────────────────────────────────

const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B',
];

// ── Chord templates ──────────────────────────────────────────────────────────
// Each template is a 12-element array where 1 = note present, 0 = absent.
// Templates are defined relative to root = C (index 0); we rotate for other roots.

interface ChordTemplate {
  name: string;
  /** Suffix appended to root name, e.g. "m" for minor */
  suffix: string;
  /** 12-element pitch class template (root at index 0) */
  template: number[];
  /** Priority for tie-breaking (lower = preferred) */
  priority: number;
}

const CHORD_TEMPLATES: ChordTemplate[] = [
  {
    name: 'Major',
    suffix: '',
    template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0], // R, M3, P5
    priority: 1,
  },
  {
    name: 'Minor',
    suffix: 'm',
    template: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0], // R, m3, P5
    priority: 2,
  },
  {
    name: 'Dominant 7th',
    suffix: '7',
    template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], // R, M3, P5, m7
    priority: 3,
  },
  {
    name: 'Major 7th',
    suffix: 'maj7',
    template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1], // R, M3, P5, M7
    priority: 4,
  },
  {
    name: 'Minor 7th',
    suffix: 'm7',
    template: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0], // R, m3, P5, m7
    priority: 5,
  },
  {
    name: 'Diminished',
    suffix: 'dim',
    template: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0], // R, m3, d5
    priority: 6,
  },
  {
    name: 'Augmented',
    suffix: 'aug',
    template: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // R, M3, A5
    priority: 7,
  },
  {
    name: 'Suspended 4th',
    suffix: 'sus4',
    template: [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0], // R, P4, P5
    priority: 8,
  },
  {
    name: 'Suspended 2nd',
    suffix: 'sus2',
    template: [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0], // R, M2, P5
    priority: 9,
  },
];

// ── Chroma extraction (reuses Goertzel approach from keyDetection.ts) ────────

function computeWindowChroma(
  data: Float32Array,
  start: number,
  windowSize: number,
  sampleRate: number
): number[] {
  const chroma = new Float64Array(12);
  const end = Math.min(start + windowSize, data.length);
  const actualSize = end - start;

  if (actualSize < 1024) return Array.from(chroma);

  // Goertzel across octaves 2-6 for each pitch class
  for (let octave = 2; octave <= 6; octave++) {
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
      const midiNote = octave * 12 + pitchClass;
      const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

      if (freq > sampleRate / 2 || freq < 50) continue;

      const k = Math.round((freq * actualSize) / sampleRate);
      const w = (2 * Math.PI * k) / actualSize;
      const coeff = 2 * Math.cos(w);

      let s0 = 0;
      let s1 = 0;
      let s2 = 0;

      for (let i = 0; i < actualSize; i++) {
        s0 = (data[start + i] ?? 0) + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }

      const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      chroma[pitchClass] += Math.max(0, power);
    }
  }

  // Normalize
  const maxVal = Math.max(...chroma);
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxVal;
    }
  }

  return Array.from(chroma);
}

// ── Template matching ────────────────────────────────────────────────────────

function rotateTemplate(template: number[], shift: number): number[] {
  const n = template.length;
  const rotated = new Array(n);
  for (let i = 0; i < n; i++) {
    rotated[i] = template[(i + shift) % n];
  }
  return rotated;
}

/**
 * Weighted cosine similarity between chroma and chord template.
 * Template notes get full weight; non-template bins penalize if energy is high.
 */
function chordSimilarity(chroma: number[], template: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 12; i++) {
    dotProduct += chroma[i] * template[i];
    normA += chroma[i] * chroma[i];
    normB += template[i] * template[i];
  }

  const denom = Math.sqrt(normA * normB);
  return denom > 0 ? dotProduct / denom : 0;
}

interface ChordMatch {
  root: number;
  template: ChordTemplate;
  similarity: number;
}

function matchChord(chroma: number[]): ChordMatch {
  let best: ChordMatch = {
    root: 0,
    template: CHORD_TEMPLATES[0],
    similarity: -1,
  };

  for (let root = 0; root < 12; root++) {
    for (const tmpl of CHORD_TEMPLATES) {
      // Rotate template so that root aligns with pitch class 'root'
      const rotated = rotateTemplate(tmpl.template, root);
      const sim = chordSimilarity(chroma, rotated);

      // Prefer simpler chords when similarity is close (within 5%)
      const adjusted = sim - tmpl.priority * 0.005;

      if (adjusted > best.similarity) {
        best = { root, template: tmpl, similarity: sim };
      }
    }
  }

  return best;
}

// ── Time formatting ──────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect chord progression from an AudioBuffer.
 *
 * Uses overlapping windows to compute chroma features and matches
 * against chord templates. Adjacent windows with the same chord are merged.
 *
 * @param audioBuffer - Decoded audio
 * @param windowSeconds - Analysis window size in seconds (default: 2s)
 * @param hopSeconds - Hop between windows in seconds (default: 1s)
 */
export function detectChords(
  audioBuffer: AudioBuffer,
  windowSeconds: number = 2,
  hopSeconds: number = 1
): ChordProgressionResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;

  const windowSamples = Math.floor(windowSeconds * sampleRate);
  const hopSamples = Math.floor(hopSeconds * sampleRate);

  if (channelData.length < windowSamples) {
    return { chords: [], progression: 'N/A', confidence: 0 };
  }

  // Step 1: Detect chord per window
  const rawChords: { time: number; match: ChordMatch }[] = [];

  for (
    let offset = 0;
    offset + windowSamples <= channelData.length;
    offset += hopSamples
  ) {
    // Check if window has sufficient energy (skip silence)
    let rmsSum = 0;
    const stride = Math.max(1, Math.floor(windowSamples / 512));
    for (let i = 0; i < windowSamples; i += stride) {
      const s = channelData[offset + i] ?? 0;
      rmsSum += s * s;
    }
    const rms = Math.sqrt(rmsSum / Math.ceil(windowSamples / stride));

    if (rms < 0.005) continue; // silence — skip

    const chroma = computeWindowChroma(
      channelData,
      offset,
      windowSamples,
      sampleRate
    );
    const match = matchChord(chroma);

    rawChords.push({
      time: offset / sampleRate,
      match,
    });
  }

  if (rawChords.length === 0) {
    return { chords: [], progression: 'N/A', confidence: 0 };
  }

  // Step 2: Merge adjacent windows with the same chord
  const merged: DetectedChord[] = [];
  let currentRoot = rawChords[0].match.root;
  let currentTemplate = rawChords[0].match.template;
  let segmentStart = rawChords[0].time;
  let segmentEnd = rawChords[0].time + windowSeconds;
  let confidenceSum = rawChords[0].match.similarity;
  let count = 1;

  for (let i = 1; i < rawChords.length; i++) {
    const { match, time } = rawChords[i];

    if (match.root === currentRoot && match.template.name === currentTemplate.name) {
      // Same chord — extend segment
      segmentEnd = time + windowSeconds;
      confidenceSum += match.similarity;
      count++;
    } else {
      // Different chord — finalize previous segment
      merged.push({
        timeRange: `${formatTime(segmentStart)}–${formatTime(Math.min(segmentEnd, duration))}`,
        chord: `${NOTE_NAMES[currentRoot]}${currentTemplate.suffix}`,
        root: NOTE_NAMES[currentRoot],
        quality: currentTemplate.name,
        confidence: Math.round((confidenceSum / count) * 100) / 100,
      });

      currentRoot = match.root;
      currentTemplate = match.template;
      segmentStart = time;
      segmentEnd = time + windowSeconds;
      confidenceSum = match.similarity;
      count = 1;
    }
  }

  // Finalize last segment
  merged.push({
    timeRange: `${formatTime(segmentStart)}–${formatTime(Math.min(segmentEnd, duration))}`,
    chord: `${NOTE_NAMES[currentRoot]}${currentTemplate.suffix}`,
    root: NOTE_NAMES[currentRoot],
    quality: currentTemplate.name,
    confidence: Math.round((confidenceSum / count) * 100) / 100,
  });

  // Step 3: Build progression string (unique chords in order, deduped consecutively)
  const uniqueSequence: string[] = [];
  for (const chord of merged) {
    if (uniqueSequence.length === 0 || uniqueSequence[uniqueSequence.length - 1] !== chord.chord) {
      uniqueSequence.push(chord.chord);
    }
  }
  const progression = uniqueSequence.join(' – ');

  // Overall confidence
  const avgConfidence =
    merged.reduce((s, c) => s + c.confidence, 0) / merged.length;

  return {
    chords: merged,
    progression,
    confidence: Math.round(avgConfidence * 100) / 100,
  };
}
