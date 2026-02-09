import { describe, expect, it } from 'vitest';
import { validateBlueprint } from '../blueprintValidation';

describe('validateBlueprint', () => {
  it('accepts a valid reconstruction blueprint payload', () => {
    const valid = validateBlueprint({
      telemetry: { bpm: '128', key: 'F Minor', groove: 'steady' },
      arrangement: [{ timeRange: '0:00-0:20', label: 'Intro', description: 'Start' }],
      instrumentation: [
        {
          element: 'Bass',
          timbre: 'Warm',
          frequency: '40-120Hz',
          abletonDevice: 'Operator',
        },
      ],
      fxChain: [{ artifact: 'Compression', recommendation: 'Glue Compressor' }],
      secretSauce: { trick: 'Saturation', execution: 'Subtle drive' },
    });

    expect(valid.telemetry.bpm).toBe('128');
    expect(valid.arrangement).toHaveLength(1);
  });

  it('rejects invalid shapes that would break rendering', () => {
    expect(() =>
      validateBlueprint({
        telemetry: { bpm: '128' },
      }),
    ).toThrowError(/invalid blueprint/i);
  });
});
