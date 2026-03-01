import { describe, it, expect } from 'vitest';
import { parseGeminiEnhancement, mergeGeminiEnhancement } from '../../services/gemini';
import type { ReconstructionBlueprint } from '../../types';

const baseBlueprint: ReconstructionBlueprint = {
  telemetry: { bpm: '128', key: 'F minor', groove: 'Straight 4/4 groove' },
  arrangement: [{ timeRange: '0:00–0:16', label: 'Intro', description: 'Sparse intro' }],
  instrumentation: [
    { element: 'Sub Bass', timbre: 'Warm sine', frequency: 'Sub', abletonDevice: 'Operator' },
    {
      element: 'Lead Synth',
      timbre: 'Bright saw',
      frequency: 'Upper mids',
      abletonDevice: 'Wavetable',
    },
  ],
  fxChain: [{ artifact: 'Reverb tail', recommendation: 'Hybrid Reverb' }],
  secretSauce: {
    trick: 'Sidechain pump',
    execution: 'Use Compressor sidechain from kick',
  },
};

describe('geminiService — parseGeminiEnhancement', () => {
  it('parses valid enhancement JSON', () => {
    const raw = JSON.stringify({
      groove: 'Driving 4-on-the-floor with heavy swing',
      instrumentation: [
        {
          element: 'Sub Bass',
          timbre: 'Deep rounded sub',
          abletonDevice: 'Operator FM, sine carrier, attack 10ms',
        },
      ],
      fxChain: [{ artifact: 'Reverb tail', recommendation: 'Hybrid Reverb: Shimmer 18%' }],
      secretSauce: { trick: 'Parallel compression', execution: 'Mix via Rack macro' },
    });
    const result = parseGeminiEnhancement(raw);
    expect(result).not.toBeNull();
    expect(result?.groove).toBe('Driving 4-on-the-floor with heavy swing');
    expect(result?.instrumentation?.[0].timbre).toContain('sub');
  });

  it('returns null for invalid JSON', () => {
    expect(parseGeminiEnhancement('not json {')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseGeminiEnhancement('')).toBeNull();
  });

  it('strips markdown code fences before parsing', () => {
    const raw = '```json\n{"groove":"smooth"}\n```';
    const result = parseGeminiEnhancement(raw);
    expect(result?.groove).toBe('smooth');
  });
});

describe('geminiService — mergeGeminiEnhancement', () => {
  it('merges enhanced groove into blueprint without changing measured values', () => {
    const merged = mergeGeminiEnhancement(baseBlueprint, { groove: 'Bouncy syncopated' });
    expect(merged.telemetry.groove).toBe('Bouncy syncopated');
    expect(merged.telemetry.bpm).toBe('128');
    expect(merged.telemetry.key).toBe('F minor');
  });

  it('merges instrumentation timbre and device by element name', () => {
    const merged = mergeGeminiEnhancement(baseBlueprint, {
      instrumentation: [
        {
          element: 'Lead Synth',
          timbre: 'Glassy detuned saw',
          abletonDevice: 'Wavetable: Saw + Detuned, Filter cutoff 2kHz',
        },
      ],
    });
    const lead = merged.instrumentation.find((i) => i.element === 'Lead Synth')!;
    expect(lead.timbre).toBe('Glassy detuned saw');
    expect(lead.abletonDevice).toContain('Wavetable');
    // Other instruments unchanged
    expect(merged.instrumentation.find((i) => i.element === 'Sub Bass')?.timbre).toBe('Warm sine');
  });

  it('ignores elements not present in blueprint', () => {
    const merged = mergeGeminiEnhancement(baseBlueprint, {
      instrumentation: [{ element: 'Ghost Track', timbre: 'Should be ignored' }],
    });
    expect(merged.instrumentation).toHaveLength(2);
  });

  it('returns original blueprint when enhancement is null', () => {
    const merged = mergeGeminiEnhancement(baseBlueprint, null);
    expect(merged).toEqual(baseBlueprint);
  });
});
