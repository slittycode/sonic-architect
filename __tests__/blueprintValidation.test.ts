import { describe, it, expect } from 'vitest';
import { validateBlueprint } from '../services/blueprintValidation';
import type { ReconstructionBlueprint } from '../types';

const VALID_BLUEPRINT: ReconstructionBlueprint = {
  telemetry: {
    bpm: '120',
    key: 'C minor',
    groove: 'Driving four-on-the-floor',
    bpmConfidence: 0.92,
    keyConfidence: 0.85,
  },
  arrangement: [
    { timeRange: '0:00–0:30', label: 'Intro', description: 'Sparse atmosphere with reverb pad.' },
    { timeRange: '0:30–2:00', label: 'Main', description: 'Full instrumentation with bass & drums.' },
  ],
  instrumentation: [
    { element: 'Kick', timbre: 'Punchy, sub-heavy', frequency: '40–100 Hz', abletonDevice: 'Drum Rack → Kick' },
  ],
  fxChain: [
    { artifact: 'Low-end rumble', recommendation: 'EQ Eight: high-pass at 30Hz, 24dB/oct' },
  ],
  secretSauce: {
    trick: 'Sidechain compression',
    execution: 'Route kick to sidechain on bass group. Ratio 4:1, fast attack, medium release.',
  },
  meta: {
    provider: 'local',
    analysisTime: 450,
    sampleRate: 44100,
    duration: 120,
    channels: 2,
  },
};

describe('Blueprint Validation', () => {
  it('accepts a valid blueprint', () => {
    const result = validateBlueprint(VALID_BLUEPRINT);
    expect(result.telemetry.bpm).toBe('120');
    expect(result.arrangement).toHaveLength(2);
  });

  it('accepts a blueprint without optional meta', () => {
    const { meta: _, ...noMeta } = VALID_BLUEPRINT;
    const result = validateBlueprint(noMeta);
    expect(result.meta).toBeUndefined();
  });

  it('accepts a blueprint without optional confidence fields', () => {
    const bp = {
      ...VALID_BLUEPRINT,
      telemetry: { bpm: '90', key: 'A major', groove: 'Chilled' },
    };
    const result = validateBlueprint(bp);
    expect(result.telemetry.bpmConfidence).toBeUndefined();
  });

  it('rejects blueprint with missing telemetry', () => {
    const { telemetry: _, ...bad } = VALID_BLUEPRINT;
    expect(() => validateBlueprint(bad)).toThrow();
  });

  it('rejects blueprint with wrong telemetry types', () => {
    const bad = {
      ...VALID_BLUEPRINT,
      telemetry: { bpm: 120, key: 'C', groove: 'driving' }, // bpm should be string
    };
    expect(() => validateBlueprint(bad)).toThrow();
  });

  it('rejects blueprint with missing arrangement array', () => {
    const { arrangement: _, ...bad } = VALID_BLUEPRINT;
    expect(() => validateBlueprint(bad)).toThrow();
  });

  it('rejects null input', () => {
    expect(() => validateBlueprint(null)).toThrow();
  });

  it('rejects empty object', () => {
    expect(() => validateBlueprint({})).toThrow();
  });

  it('accepts empty arrays for arrangement/instrumentation/fxChain', () => {
    const bp = {
      ...VALID_BLUEPRINT,
      arrangement: [],
      instrumentation: [],
      fxChain: [],
    };
    const result = validateBlueprint(bp);
    expect(result.arrangement).toHaveLength(0);
    expect(result.instrumentation).toHaveLength(0);
  });
});
