import { describe, it, expect } from 'vitest';
import { phase1Schema } from '@/services/gemini/schemas/phase1Schema';
import { phase2Schema } from '@/services/gemini/schemas/phase2Schema';

// ---------------------------------------------------------------------------
// Phase 1 Schema
// ---------------------------------------------------------------------------

const validPhase1 = {
  bpm: 128,
  bpmConfidence: 0.92,
  key: 'F minor',
  keyConfidence: 0.85,
  timeSignature: '4/4',
  genre: 'Techno',
  subGenre: 'Industrial Techno',
  groove: 'four-on-the-floor',
  grooveDescription: 'Driving mechanical pulse',
  energy: 0.8,
  chordProgression: {
    chords: [{ chord: 'Fm', startTime: 0, duration: 4 }],
    summary: 'Fm pedal point throughout',
  },
  elements: [
    {
      name: 'Kick',
      frequencyRange: '40–100 Hz',
      sonicCharacter: 'Punchy and distorted',
      howToRecreate: 'Use Drum Rack with a layered kick sample',
      suggestedDevices: ['Drum Rack', 'Saturator'],
      role: 'rhythm',
    },
  ],
  detectedCharacteristics: {
    sidechain: { present: true, description: 'Heavy compressor sidechain pump' },
    acidResonance: { present: false, description: '' },
    reverbCharacter: { present: true, description: 'Long hall reverb on pads' },
    distortion: { present: false, description: '' },
    supersawLayers: { present: false, description: '' },
    vocalPresence: { present: false, description: '' },
    bassCharacter: { description: 'Rolling sub bass', type: 'sub' },
    groove: { description: 'Straight mechanical pulse', swingAmount: '0%' },
  },
  arrangement: [
    { section: 'intro', startTime: 0, endTime: 32, description: 'Sparse drums only', energyLevel: 0.2 },
    { section: 'drop', startTime: 64, endTime: 128, description: 'Full energy', energyLevel: 0.95 },
  ],
  instrumentation: [
    {
      name: 'Lead Synth',
      type: 'synth',
      description: 'Distorted modular lead',
      abletonDevice: 'Operator',
      deviceChain: ['Operator', 'Saturator', 'EQ Eight'],
      presetSuggestion: 'Init — FM patch',
      parameterNotes: 'Ratio 3:1, high FM amount',
    },
  ],
  effectsChain: [
    {
      name: 'Reverb Send',
      type: 'reverb',
      purpose: 'Space and depth',
      abletonDevice: 'Reverb',
      settings: 'Large room, 3.5s decay',
    },
  ],
  secretSauce: {
    technique: 'Sidechain compression',
    description: 'Heavy Glue Compressor sidechain from kick',
    abletonImplementation: 'Route kick to Glue Compressor sidechain input',
  },
  genreAnalysis: {
    primary: 'Techno',
    secondary: ['Industrial', 'EBM'],
    confidence: 0.91,
    reasoning: 'BPM 128, 4-on-the-floor, dark distorted timbres',
  },
};

describe('phase1Schema', () => {
  it('validates a complete valid Phase 1 response', () => {
    const result = phase1Schema.safeParse(validPhase1);
    expect(result.success).toBe(true);
    expect(result.data?.bpm).toBe(128);
    expect(result.data?.key).toBe('F minor');
    expect(result.data?.elements).toHaveLength(1);
    expect(result.data?.arrangement).toHaveLength(2);
  });

  it('coerces string bpm "128" to number 128', () => {
    const result = phase1Schema.safeParse({ ...validPhase1, bpm: '128' });
    expect(result.success).toBe(true);
    expect(result.data?.bpm).toBe(128);
  });

  it('falls back bpm to 120 when value is "invalid"', () => {
    const result = phase1Schema.safeParse({ ...validPhase1, bpm: 'invalid' });
    expect(result.success).toBe(true);
    expect(result.data?.bpm).toBe(120);
  });

  it('falls back key to "C major" when missing', () => {
    const { key: _key, ...rest } = validPhase1;
    const result = phase1Schema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.data?.key).toBe('C major');
  });

  it('returns empty array for elements when field is missing', () => {
    const { elements: _elements, ...rest } = validPhase1;
    const result = phase1Schema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.data?.elements).toEqual([]);
  });

  it('returns empty array for arrangement when field is missing', () => {
    const { arrangement: _arrangement, ...rest } = validPhase1;
    const result = phase1Schema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.data?.arrangement).toEqual([]);
  });

  it('falls back energyLevel to 0.5 when out of range (> 1)', () => {
    const result = phase1Schema.safeParse({
      ...validPhase1,
      arrangement: [{ section: 'drop', startTime: 64, endTime: 128, description: 'Full', energyLevel: 1.5 }],
    });
    expect(result.success).toBe(true);
    // Schema uses .catch(0.5) — out-of-range values fall back to the default, not clamped
    expect(result.data?.arrangement[0].energyLevel).toBe(0.5);
  });

  it('coerces string startTime/endTime in arrangement sections', () => {
    const result = phase1Schema.safeParse({
      ...validPhase1,
      arrangement: [{ section: 'drop', startTime: '64', endTime: '128', description: '', energyLevel: 0.9 }],
    });
    expect(result.success).toBe(true);
    expect(result.data?.arrangement[0].startTime).toBe(64);
    expect(result.data?.arrangement[0].endTime).toBe(128);
  });

  it('applies all-default fallbacks when object is empty {}', () => {
    const result = phase1Schema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.bpm).toBe(120);
    expect(result.data?.key).toBe('C major');
    expect(result.data?.genre).toBe('Unknown');
    expect(result.data?.timeSignature).toBe('4/4');
    expect(result.data?.elements).toEqual([]);
    expect(result.data?.arrangement).toEqual([]);
    expect(result.data?.instrumentation).toEqual([]);
    expect(result.data?.effectsChain).toEqual([]);
  });

  it('detectedCharacteristics sidechain falls back to present:false when missing', () => {
    const result = phase1Schema.safeParse({
      ...validPhase1,
      detectedCharacteristics: {},
    });
    expect(result.success).toBe(true);
    // All sub-objects fall back to their catch defaults
    expect(result.data?.detectedCharacteristics.sidechain?.present).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 Schema
// ---------------------------------------------------------------------------

const validPhase2 = {
  mixFeedback: {
    overallBalance: 'Well-balanced across frequency spectrum',
    lowEnd: 'Sub bass is tight and controlled',
    midRange: 'Mids are slightly recessed for techno character',
    highEnd: 'Crisp hi-hats cut through cleanly',
    stereoImage: 'Wide stereo field with mono-compatible low end',
    dynamics: 'High energy, limited headroom intentional',
    recommendations: ['Add subtle high-shelf boost around 10kHz', 'Tighten the sidechain attack'],
  },
  refinedInstrumentation: [
    {
      name: 'Lead Synth',
      refinedDescription: 'Hard-sync FM with wavefolder distortion',
      detailedDeviceChain: ['Operator', 'Saturator', 'EQ Eight', 'Reverb'],
      parameterDetails: 'Oscillator A: 4-op FM, ratio 3:1',
      layeringNotes: 'Doubles with a filtered noise layer for texture',
    },
  ],
  arrangementNotes: 'Intro could be extended by 16 bars for DJ mixing headroom',
  productionInsights: [
    {
      category: 'mixing',
      insight: 'The kick sits well in the mix at -6dBFS peak',
      abletonImplementation: 'Use Glue Compressor on the drum bus',
    },
  ],
  sonicSummary: 'Dark industrial techno with heavy sidechain compression and FM synthesis',
  bpmCorrection: {
    correctedBpm: 128,
    confidence: 0.95,
    reasoning: 'Consistent 4/4 pattern confirmed by multiple markers',
  },
  keyCorrection: {
    correctedKey: 'F minor',
    confidence: 0.88,
    reasoning: 'Root note F confirmed from bassline pitch analysis',
  },
};

describe('phase2Schema', () => {
  it('validates a complete valid Phase 2 response', () => {
    const result = phase2Schema.safeParse(validPhase2);
    expect(result.success).toBe(true);
    expect(result.data?.mixFeedback.overallBalance).toBe('Well-balanced across frequency spectrum');
    expect(result.data?.refinedInstrumentation).toHaveLength(1);
    expect(result.data?.productionInsights).toHaveLength(1);
  });

  it('falls back mixFeedback to defaults when missing', () => {
    const { mixFeedback: _mf, ...rest } = validPhase2;
    const result = phase2Schema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.data?.mixFeedback.overallBalance).toBe('Not available');
    expect(result.data?.mixFeedback.recommendations).toEqual([]);
  });

  it('bpmCorrection and keyCorrection are undefined when absent', () => {
    const { bpmCorrection: _bc, keyCorrection: _kc, ...rest } = validPhase2;
    const result = phase2Schema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.data?.bpmCorrection).toBeUndefined();
    expect(result.data?.keyCorrection).toBeUndefined();
  });

  it('accepts bpmCorrection with confidence > 0.5', () => {
    const result = phase2Schema.safeParse(validPhase2);
    expect(result.success).toBe(true);
    expect(result.data?.bpmCorrection?.confidence).toBe(0.95);
    expect(result.data?.bpmCorrection?.correctedBpm).toBe(128);
  });

  it('coerces string confidence in bpmCorrection', () => {
    const result = phase2Schema.safeParse({
      ...validPhase2,
      bpmCorrection: { correctedBpm: 130, confidence: '0.7', reasoning: 'test' },
    });
    expect(result.success).toBe(true);
    expect(result.data?.bpmCorrection?.confidence).toBe(0.7);
  });

  it('returns empty arrays for refinedInstrumentation and productionInsights when missing', () => {
    const { refinedInstrumentation: _ri, productionInsights: _pi, ...rest } = validPhase2;
    const result = phase2Schema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.data?.refinedInstrumentation).toEqual([]);
    expect(result.data?.productionInsights).toEqual([]);
  });

  it('applies all-default fallbacks when object is empty {}', () => {
    const result = phase2Schema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.mixFeedback.overallBalance).toBe('Not available');
    expect(result.data?.arrangementNotes).toBe('');
    expect(result.data?.sonicSummary).toBe('');
    expect(result.data?.bpmCorrection).toBeUndefined();
  });
});
