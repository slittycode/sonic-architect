/**
 * Zod schema for Gemini Phase 1 response validation.
 *
 * Uses z.coerce for numeric fields, .default() for optional fields,
 * and .catch() for per-field fallbacks so partial Gemini responses
 * still produce usable data.
 */

import { z } from 'zod';

// --- Sub-schemas ---

const sonicElementSchema = z.object({
  name: z.string().catch('Unknown Element'),
  frequencyRange: z.string().catch('N/A'),
  sonicCharacter: z.string().catch(''),
  howToRecreate: z.string().catch(''),
  suggestedDevices: z.array(z.string()).catch([]),
  role: z.string().catch(''),
});

const detectedCharacteristicSchema = z.object({
  present: z.boolean().catch(false),
  description: z.string().catch(''),
  strength: z.string().optional(),
  estimatedDecay: z.string().optional(),
  type: z.string().optional(),
  swingAmount: z.string().optional(),
});

const arrangementSectionSchema = z.object({
  section: z.string().catch('unknown'),
  startTime: z.coerce.number().catch(0),
  endTime: z.coerce.number().catch(0),
  description: z.string().catch(''),
  energyLevel: z.coerce.number().min(0).max(1).catch(0.5),
});

const instrumentationItemSchema = z.object({
  name: z.string().catch('Unknown'),
  type: z.string().catch('synth'),
  description: z.string().catch(''),
  abletonDevice: z.string().catch(''),
  deviceChain: z.array(z.string()).catch([]),
  presetSuggestion: z.string().catch(''),
  parameterNotes: z.string().catch(''),
});

const effectsChainItemSchema = z.object({
  name: z.string().catch('Unknown'),
  type: z.string().catch(''),
  purpose: z.string().catch(''),
  abletonDevice: z.string().catch(''),
  settings: z.string().catch(''),
});

const chordEventSchema = z.object({
  chord: z.string().catch('N/A'),
  startTime: z.coerce.number().catch(0),
  duration: z.coerce.number().catch(0),
});

// --- Main Phase 1 Schema ---

export const phase1Schema = z.object({
  // Global Telemetry
  bpm: z.coerce.number().positive().catch(120),
  bpmConfidence: z.coerce.number().min(0).max(1).catch(0.5),
  key: z.string().catch('C major'),
  keyConfidence: z.coerce.number().min(0).max(1).catch(0.5),
  timeSignature: z.string().catch('4/4'),
  genre: z.string().catch('Unknown'),
  subGenre: z.string().catch(''),
  groove: z.string().catch(''),
  grooveDescription: z.string().catch(''),
  energy: z.coerce.number().min(0).max(1).catch(0.5),

  // Chord Progression
  chordProgression: z.object({
    chords: z.array(chordEventSchema).catch([]),
    summary: z.string().catch(''),
  }).catch({ chords: [], summary: '' }),

  // Sonic Elements
  elements: z.array(sonicElementSchema).catch([]),

  // Detected Characteristics
  detectedCharacteristics: z.object({
    sidechain: detectedCharacteristicSchema.catch({ present: false, description: '' }),
    acidResonance: detectedCharacteristicSchema.catch({ present: false, description: '' }),
    reverbCharacter: detectedCharacteristicSchema.catch({ present: false, description: '' }),
    distortion: detectedCharacteristicSchema.catch({ present: false, description: '' }),
    supersawLayers: detectedCharacteristicSchema.catch({ present: false, description: '' }),
    vocalPresence: detectedCharacteristicSchema.catch({ present: false, description: '' }),
    bassCharacter: z.object({
      description: z.string().catch(''),
      type: z.string().optional(),
    }).catch({ description: '' }),
    groove: z.object({
      swingAmount: z.string().optional(),
      description: z.string().catch(''),
    }).catch({ description: '' }),
  }).catch({
    sidechain: { present: false, description: '' },
    acidResonance: { present: false, description: '' },
    reverbCharacter: { present: false, description: '' },
    distortion: { present: false, description: '' },
    supersawLayers: { present: false, description: '' },
    vocalPresence: { present: false, description: '' },
    bassCharacter: { description: '' },
    groove: { description: '' },
  }),

  // Arrangement
  arrangement: z.array(arrangementSectionSchema).catch([]),

  // Instrumentation
  instrumentation: z.array(instrumentationItemSchema).catch([]),

  // Effects Chain
  effectsChain: z.array(effectsChainItemSchema).catch([]),

  // Secret Sauce
  secretSauce: z.object({
    technique: z.string().catch('Not detected'),
    description: z.string().catch('Gemini did not return secret sauce analysis.'),
    abletonImplementation: z.string().catch(''),
  }).catch({
    technique: 'Not detected',
    description: 'Gemini did not return secret sauce analysis.',
    abletonImplementation: '',
  }),

  // Genre Analysis
  genreAnalysis: z.object({
    primary: z.string().catch('Unknown'),
    secondary: z.array(z.string()).catch([]),
    confidence: z.coerce.number().min(0).max(1).catch(0),
    reasoning: z.string().catch('Not available'),
  }).catch({
    primary: 'Unknown',
    secondary: [],
    confidence: 0,
    reasoning: 'Not available',
  }),
});

export type GeminiPhase1Response = z.infer<typeof phase1Schema>;
