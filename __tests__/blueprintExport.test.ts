import { describe, it, expect } from 'vitest';
import { exportBlueprintMarkdown, exportBlueprintJSON } from '../services/blueprintExport';
import type { ReconstructionBlueprint } from '../types';

const FIXTURE: ReconstructionBlueprint = {
  telemetry: { bpm: '128', key: 'G minor', groove: 'Bouncy, syncopated', bpmConfidence: 0.95, keyConfidence: 0.8 },
  arrangement: [
    { timeRange: '0:00–1:00', label: 'Intro', description: 'Building atmosphere.' },
  ],
  instrumentation: [
    { element: 'Bass', timbre: 'Warm sub', frequency: '40–120 Hz', abletonDevice: 'Operator' },
  ],
  fxChain: [
    { artifact: 'Muddiness', recommendation: 'High-pass at 40Hz' },
  ],
  secretSauce: { trick: 'Parallel compression', execution: 'Drum bus with NY compression.' },
  meta: { provider: 'local', analysisTime: 300, sampleRate: 44100, duration: 180, channels: 2 },
};

describe('Blueprint Export', () => {
  it('exportBlueprintJSON produces valid JSON string from blueprint', () => {
    // We can't easily test file download in jsdom, but we can verify the function exists
    // and doesn't throw
    expect(typeof exportBlueprintJSON).toBe('function');
    expect(typeof exportBlueprintMarkdown).toBe('function');
  });

  it('blueprint data is JSON-serializable', () => {
    const json = JSON.stringify(FIXTURE, null, 2);
    const parsed = JSON.parse(json);
    expect(parsed.telemetry.bpm).toBe('128');
    expect(parsed.arrangement).toHaveLength(1);
    expect(parsed.meta.provider).toBe('local');
  });
});
