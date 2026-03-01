import { describe, it, expect } from 'vitest';
import { detectSupersaw, hasSupersaw } from '../supersawDetection';
import { DetectedNote } from '../../types';

/** Creates a single DetectedNote with a pitch bend array clustering at a single center value. */
function createNoteWithBend(
  pitchBendCenters: number[],
  samplesPerCenter = 20,
  midi = 60
): DetectedNote {
  // Build pitch bend array: dense clusters at each center, sparse valleys between them
  // Centers separated by 0.2 semitones (20 cents) with valley samples at mid-points
  const pitchBend: number[] = [];

  // Add boundary samples so interior voice centers are not at extremes
  const first = pitchBendCenters[0]!;
  const last = pitchBendCenters[pitchBendCenters.length - 1]!;
  pitchBend.push(first - 0.1, first - 0.1);

  for (let i = 0; i < pitchBendCenters.length; i++) {
    const center = pitchBendCenters[i]!;
    // Dense cluster at this center (peak)
    for (let j = 0; j < samplesPerCenter; j++) {
      pitchBend.push(center);
    }
    // Sparse valley before next center
    if (i < pitchBendCenters.length - 1) {
      const next = pitchBendCenters[i + 1]!;
      const mid = (center + next) / 2;
      pitchBend.push(mid, mid);
    }
  }

  // Boundary on the other end
  pitchBend.push(last + 0.1, last + 0.1);

  return {
    midi,
    name: 'C4',
    frequency: 261.63,
    startTime: 0,
    duration: 1,
    velocity: 64,
    confidence: 0.8,
    pitchBend,
  };
}

/** Creates 3 notes each with 5 voice centers spaced 0.2 semitones (20 cents) apart. */
function createSupersawNotes(): DetectedNote[] {
  // 5 voice centers at -0.4, -0.2, 0.0, 0.2, 0.4 (20-cent spacing = optimal for supersaw)
  const centers = [-0.4, -0.2, 0.0, 0.2, 0.4];
  return [
    createNoteWithBend(centers, 20, 60),
    createNoteWithBend(centers, 20, 62),
    createNoteWithBend(centers, 20, 64),
  ];
}

describe('detectSupersaw', () => {
  it('returns a valid SupersawDetectionResult object', () => {
    const result = detectSupersaw([]);

    expect(result).toHaveProperty('isSupersaw');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('voiceCount');
    expect(result).toHaveProperty('avgDetuneCents');
    expect(result).toHaveProperty('spectralComplexity');
  });

  it('returns isSupersaw: false for empty notes array', () => {
    const result = detectSupersaw([]);
    expect(result.isSupersaw).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('returns isSupersaw: false when fewer than 3 notes with pitch bend', () => {
    const twoNotes: DetectedNote[] = [
      {
        midi: 60,
        name: 'C4',
        frequency: 261.63,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
        pitchBend: [0.1, -0.1],
      },
      {
        midi: 62,
        name: 'D4',
        frequency: 293.66,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
        pitchBend: [0.1, -0.1],
      },
    ];
    const result = detectSupersaw(twoNotes);
    expect(result.isSupersaw).toBe(false);
  });

  it('returns isSupersaw: false for notes without pitch bend data', () => {
    const notesNoBend: DetectedNote[] = [
      {
        midi: 60,
        name: 'C4',
        frequency: 261.63,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
      },
      {
        midi: 62,
        name: 'D4',
        frequency: 293.66,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
      },
      {
        midi: 64,
        name: 'E4',
        frequency: 329.63,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
      },
      {
        midi: 67,
        name: 'G4',
        frequency: 392.0,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
      },
    ];
    const result = detectSupersaw(notesNoBend);
    expect(result.isSupersaw).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('returns confidence in [0, 1] range (verifies clamp fix)', () => {
    // Test with high spectralComplexity (triggers +0.1 boost) to verify clamp
    const supersaw = createSupersawNotes();
    const result = detectSupersaw(supersaw, 10);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('returns confidence in [0, 1] even with max spectral complexity boost', () => {
    // The 0.1 complexityBoost can push confidence above 1.0 without the clamp fix
    const supersaw = createSupersawNotes();
    for (let complexity = 0; complexity <= 20; complexity += 5) {
      const result = detectSupersaw(supersaw, complexity);
      expect(result.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('detects supersaw in notes with multi-voice pitch bend clusters', () => {
    const supersaw = createSupersawNotes();
    const result = detectSupersaw(supersaw);
    expect(result.isSupersaw).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('returns higher voiceCount for multi-voice notes than single-voice notes', () => {
    const multiVoice = createSupersawNotes();
    const singleVoice: DetectedNote[] = [
      {
        midi: 60,
        name: 'C4',
        frequency: 261.63,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
        pitchBend: new Array(30).fill(0.0),
      },
      {
        midi: 62,
        name: 'D4',
        frequency: 293.66,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
        pitchBend: new Array(30).fill(0.0),
      },
      {
        midi: 64,
        name: 'E4',
        frequency: 329.63,
        startTime: 0,
        duration: 1,
        velocity: 64,
        confidence: 0.8,
        pitchBend: new Array(30).fill(0.0),
      },
    ];

    const multiResult = detectSupersaw(multiVoice);
    const singleResult = detectSupersaw(singleVoice);
    expect(multiResult.voiceCount).toBeGreaterThan(singleResult.voiceCount);
  });

  it('spreads spectralComplexity field from input', () => {
    const result = detectSupersaw([], 7.5);
    expect(result.spectralComplexity).toBe(7.5);
  });

  it('defaults spectralComplexity to 0 when not provided', () => {
    const result = detectSupersaw([]);
    expect(result.spectralComplexity).toBe(0);
  });
});

describe('hasSupersaw', () => {
  it('returns false for empty notes', () => {
    expect(hasSupersaw([])).toBe(false);
  });

  it('returns true for clear supersaw pattern', () => {
    expect(hasSupersaw(createSupersawNotes())).toBe(true);
  });
});
