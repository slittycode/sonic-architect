import type { ChordSegment } from '../types';

export interface ChordProgressionResult {
  chords: ChordSegment[];
  progression: string;
  confidence: number;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

interface ChordTemplate {
  name: string;
  suffix: string;
  template: number[];
  priority: number;
}

const CHORD_TEMPLATES: ChordTemplate[] = [
  {
    name: 'Major',
    suffix: '',
    template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    priority: 1,
  },
  {
    name: 'Minor',
    suffix: 'm',
    template: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
    priority: 2,
  },
  {
    name: 'Dominant 7th',
    suffix: '7',
    template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    priority: 3,
  },
  {
    name: 'Major 7th',
    suffix: 'maj7',
    template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
    priority: 4,
  },
  {
    name: 'Minor 7th',
    suffix: 'm7',
    template: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
    priority: 5,
  },
  {
    name: 'Diminished',
    suffix: 'dim',
    template: [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    priority: 6,
  },
  {
    name: 'Augmented',
    suffix: 'aug',
    template: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    priority: 7,
  },
  {
    name: 'Suspended 4th',
    suffix: 'sus4',
    template: [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
    priority: 8,
  },
  {
    name: 'Suspended 2nd',
    suffix: 'sus2',
    template: [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
    priority: 9,
  },
];

interface ChordMatch {
  root: number;
  template: ChordTemplate;
  similarity: number;
}

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

  for (let octave = 2; octave <= 6; octave++) {
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
      const midiNote = octave * 12 + pitchClass;
      const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);

      if (frequency > sampleRate / 2 || frequency < 50) continue;

      const k = Math.round((frequency * actualSize) / sampleRate);
      const w = (2 * Math.PI * k) / actualSize;
      const coefficient = 2 * Math.cos(w);

      let s0 = 0;
      let s1 = 0;
      let s2 = 0;

      for (let i = 0; i < actualSize; i++) {
        s0 = (data[start + i] ?? 0) + coefficient * s1 - s2;
        s2 = s1;
        s1 = s0;
      }

      const power = s1 * s1 + s2 * s2 - coefficient * s1 * s2;
      chroma[pitchClass] += Math.max(0, power);
    }
  }

  const maxValue = Math.max(...chroma);
  if (maxValue > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxValue;
    }
  }

  return Array.from(chroma);
}

function rotateTemplate(template: number[], shift: number): number[] {
  const size = template.length;
  const rotated = new Array(size);
  for (let i = 0; i < size; i++) {
    rotated[i] = template[(i + shift) % size];
  }
  return rotated;
}

function chordSimilarity(chroma: number[], template: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < 12; i++) {
    dotProduct += chroma[i] * template[i];
    normA += chroma[i] * chroma[i];
    normB += template[i] * template[i];
  }

  const denominator = Math.sqrt(normA * normB);
  return denominator > 0 ? dotProduct / denominator : 0;
}

function matchChord(chroma: number[]): ChordMatch {
  let best: ChordMatch = {
    root: 0,
    template: CHORD_TEMPLATES[0],
    similarity: -1,
  };

  for (let root = 0; root < 12; root++) {
    for (const template of CHORD_TEMPLATES) {
      const rotatedTemplate = rotateTemplate(template.template, root);
      const similarity = chordSimilarity(chroma, rotatedTemplate);
      const adjustedScore = similarity - template.priority * 0.005;

      if (adjustedScore > best.similarity) {
        best = { root, template, similarity };
      }
    }
  }

  return best;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function parseTimeRange(s: string): number {
  const parts = s.trim().split(':');
  return parseInt(parts[0]) * 60 + parseInt(parts[1] ?? '0');
}

export function detectChords(
  audioBuffer: AudioBuffer,
  windowSeconds: number = 2,
  hopSeconds: number = 2
): ChordProgressionResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const duration = audioBuffer.duration;

  const windowSamples = Math.floor(windowSeconds * sampleRate);
  const hopSamples = Math.floor(hopSeconds * sampleRate);

  if (channelData.length < windowSamples) {
    return { chords: [], progression: 'N/A', confidence: 0 };
  }

  const rawChords: { time: number; match: ChordMatch }[] = [];

  for (let offset = 0; offset + windowSamples <= channelData.length; offset += hopSamples) {
    let rmsSum = 0;
    const stride = Math.max(1, Math.floor(windowSamples / 512));
    for (let i = 0; i < windowSamples; i += stride) {
      const sample = channelData[offset + i] ?? 0;
      rmsSum += sample * sample;
    }
    const rms = Math.sqrt(rmsSum / Math.ceil(windowSamples / stride));

    if (rms < 0.005) continue;

    const chroma = computeWindowChroma(channelData, offset, windowSamples, sampleRate);
    const match = matchChord(chroma);

    rawChords.push({
      time: offset / sampleRate,
      match,
    });
  }

  if (rawChords.length === 0) {
    return { chords: [], progression: 'N/A', confidence: 0 };
  }

  const merged: ChordSegment[] = [];
  let currentRoot = rawChords[0].match.root;
  let currentTemplate = rawChords[0].match.template;
  let segmentStart = rawChords[0].time;
  let segmentEnd = rawChords[0].time + windowSeconds;
  let confidenceSum = rawChords[0].match.similarity;
  let count = 1;

  for (let i = 1; i < rawChords.length; i++) {
    const { match, time } = rawChords[i];

    if (match.root === currentRoot && match.template.name === currentTemplate.name) {
      segmentEnd = time + windowSeconds;
      confidenceSum += match.similarity;
      count++;
    } else {
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

  merged.push({
    timeRange: `${formatTime(segmentStart)}–${formatTime(Math.min(segmentEnd, duration))}`,
    chord: `${NOTE_NAMES[currentRoot]}${currentTemplate.suffix}`,
    root: NOTE_NAMES[currentRoot],
    quality: currentTemplate.name,
    confidence: Math.round((confidenceSum / count) * 100) / 100,
  });

  // Post-process: confidence and minimum duration filters
  const MIN_CONFIDENCE = 0.45;
  const MIN_DURATION_S = 2;
  const filtered = merged.filter((seg) => {
    const [startStr, endStr] = seg.timeRange.split('–');
    const start = parseTimeRange(startStr);
    const end = parseTimeRange(endStr);
    return seg.confidence >= MIN_CONFIDENCE && end - start >= MIN_DURATION_S;
  });
  const postFiltered = filtered.length >= 2 ? filtered : merged;

  // Cap at 32 segments by downsampling if needed
  const final: ChordSegment[] =
    postFiltered.length <= 32
      ? postFiltered
      : postFiltered.filter((_, i) => i % Math.ceil(postFiltered.length / 32) === 0);

  const uniqueSequence: string[] = [];
  for (const chord of final) {
    if (uniqueSequence.length === 0 || uniqueSequence[uniqueSequence.length - 1] !== chord.chord) {
      uniqueSequence.push(chord.chord);
    }
  }

  const progression = uniqueSequence.join(' – ');
  const averageConfidence = final.reduce((sum, chord) => sum + chord.confidence, 0) / final.length;

  return {
    chords: final,
    progression,
    confidence: Math.round(averageConfidence * 100) / 100,
  };
}
