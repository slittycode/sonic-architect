/**
 * Zod schema for Gemini Phase 2 response validation.
 *
 * Phase 2 is the "actionable synthesis" pass — it turns Phase 1's exhaustive
 * detection into parameter-level Ableton Live 12 recreation advice:
 * full device chains, effects settings, secret sauce, mix feedback.
 */

import { z } from 'zod';

// --- Actionable schemas (the core of Phase 2) ---

const instrumentationItemSchema = z.object({
  name: z.string().catch('Unknown'),
  type: z.string().catch('synth'),
  description: z.string().catch(''),
  abletonDevice: z.string().catch(''),
  deviceChain: z.union([z.array(z.string()), z.string()]).transform((v) =>
    typeof v === 'string' ? v : v.join(' → ')
  ).catch(''),
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

const secretSauceSchema = z.object({
  technique: z.string().catch('Not detected'),
  description: z.string().catch(''),
  abletonImplementation: z.string().catch(''),
});

// --- Mix feedback & insights (carried forward from original Phase 2) ---

const mixFeedbackSchema = z.object({
  overallBalance: z.string().catch('Not available'),
  lowEnd: z.string().catch(''),
  midRange: z.string().catch(''),
  highEnd: z.string().catch(''),
  stereoImage: z.string().catch(''),
  dynamics: z.string().catch(''),
  recommendations: z.array(z.string()).catch([]),
});

const refinedInstrumentationSchema = z.object({
  name: z.string().catch('Unknown'),
  refinedDescription: z.string().catch(''),
  detailedDeviceChain: z.array(z.string()).catch([]),
  parameterDetails: z.string().catch(''),
  layeringNotes: z.string().catch(''),
});

const productionInsightSchema = z.object({
  category: z.string().catch('general'),
  insight: z.string().catch(''),
  abletonImplementation: z.string().catch(''),
});

export const phase2Schema = z.object({
  // --- Core actionable fields (new in restructured Phase 2) ---

  // Full instrumentation with device chains and parameter-level detail
  instrumentation: z.array(instrumentationItemSchema).catch([]),

  // Effects chain with precise settings
  effectsChain: z.array(effectsChainItemSchema).catch([]),

  // Secret sauce technique
  secretSauce: secretSauceSchema.catch({
    technique: 'Not detected',
    description: '',
    abletonImplementation: '',
  }),

  // --- Analysis & feedback fields ---

  // Mix feedback prose
  mixFeedback: mixFeedbackSchema.catch({
    overallBalance: 'Not available',
    lowEnd: '',
    midRange: '',
    highEnd: '',
    stereoImage: '',
    dynamics: '',
    recommendations: [],
  }),

  // Legacy refined instrumentation (kept for backward compatibility)
  refinedInstrumentation: z.array(refinedInstrumentationSchema).catch([]),

  // Arrangement refinements — corrections or additions to Phase 1 sections
  arrangementNotes: z.string().catch(''),

  // Production insights
  productionInsights: z.array(productionInsightSchema).catch([]),

  // Overall sonic character summary
  sonicSummary: z.string().catch(''),

  // BPM / key corrections (only if Gemini is >50% confident the DSP value is wrong)
  // .nullable() because models often return null when no correction is needed
  bpmCorrection: z.object({
    correctedBpm: z.coerce.number().positive().optional(),
    confidence: z.coerce.number().min(0).max(1).catch(0),
    reasoning: z.string().catch(''),
  }).nullable().optional(),

  keyCorrection: z.object({
    correctedKey: z.string().optional(),
    confidence: z.coerce.number().min(0).max(1).catch(0),
    reasoning: z.string().catch(''),
  }).nullable().optional(),
});

export type GeminiPhase2Additions = z.infer<typeof phase2Schema>;
