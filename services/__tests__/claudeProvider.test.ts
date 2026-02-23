import { describe, expect, it } from 'vitest';
import type { ReconstructionBlueprint } from '../../types';
import {
  mergeClaudeEnhancement,
  parseClaudeEnhancement,
} from '../claudeProvider';

function makeBlueprint(): ReconstructionBlueprint {
  return {
    telemetry: {
      bpm: '128',
      key: 'F Minor',
      groove: 'Original groove',
      bpmConfidence: 0.9,
      keyConfidence: 0.8,
    },
    arrangement: [
      { timeRange: '0:00-0:30', label: 'Intro', description: 'Builds energy' },
    ],
    instrumentation: [
      {
        element: 'Bass',
        timbre: 'Warm',
        frequency: '40-120Hz',
        abletonDevice: 'Operator',
      },
    ],
    fxChain: [
      {
        artifact: 'Transient softening',
        recommendation: 'Use Drum Buss',
      },
    ],
    secretSauce: {
      trick: 'Parallel saturation',
      execution: 'Duplicate and blend',
    },
    meta: {
      provider: 'local',
      analysisTime: 123,
      sampleRate: 48000,
      duration: 180,
      channels: 2,
    },
  };
}

describe('parseClaudeEnhancement', () => {
  it('parses JSON wrapped in markdown fences', () => {
    const parsed = parseClaudeEnhancement(
      '```json\n{"groove":"Enhanced groove"}\n```',
    );
    expect(parsed).toEqual({ groove: 'Enhanced groove' });
  });

  it('returns null when JSON is invalid', () => {
    const parsed = parseClaudeEnhancement('not-json');
    expect(parsed).toBeNull();
  });
});

describe('mergeClaudeEnhancement', () => {
  it('updates only matching descriptive fields', () => {
    const blueprint = makeBlueprint();
    const merged = mergeClaudeEnhancement(blueprint, {
      groove: 'More syncopated groove',
      instrumentation: [
        {
          element: 'Bass',
          timbre: 'Round low-end',
          abletonDevice: 'Analog',
        },
      ],
      fxChain: [
        {
          artifact: 'Transient softening',
          recommendation: 'Drum Buss transient +15%',
        },
      ],
      secretSauce: {
        trick: 'Micro timing offsets',
        execution: 'Nudge hats by 8ms',
      },
    });

    expect(merged.telemetry.groove).toBe('More syncopated groove');
    expect(merged.instrumentation[0].timbre).toBe('Round low-end');
    expect(merged.instrumentation[0].abletonDevice).toBe('Analog');
    expect(merged.instrumentation[0].frequency).toBe('40-120Hz');
    expect(merged.fxChain[0].recommendation).toBe('Drum Buss transient +15%');
    expect(merged.secretSauce.trick).toBe('Micro timing offsets');
    expect(merged.secretSauce.execution).toBe('Nudge hats by 8ms');
  });
});
