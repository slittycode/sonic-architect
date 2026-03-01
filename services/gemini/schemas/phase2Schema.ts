/**
 * Zod schema for Gemini Phase 2 response validation.
 *
 * Phase 2 refines the Phase 1 analysis with deeper musical insight,
 * mix balance feedback, and production-focused recommendations.
 */

import { z } from 'zod';

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

  // Refined instrumentation with deeper detail
  refinedInstrumentation: z.array(refinedInstrumentationSchema).catch([]),

  // Arrangement refinements — corrections or additions to Phase 1 sections
  arrangementNotes: z.string().catch(''),

  // Production insights
  productionInsights: z.array(productionInsightSchema).catch([]),

  // Overall sonic character summary
  sonicSummary: z.string().catch(''),

  // BPM / key corrections (only if Gemini is >50% confident the DSP value is wrong)
  bpmCorrection: z.object({
    correctedBpm: z.coerce.number().positive().optional(),
    confidence: z.coerce.number().min(0).max(1).catch(0),
    reasoning: z.string().catch(''),
  }).optional(),

  keyCorrection: z.object({
    correctedKey: z.string().optional(),
    confidence: z.coerce.number().min(0).max(1).catch(0),
    reasoning: z.string().catch(''),
  }).optional(),
});

export type GeminiPhase2Additions = z.infer<typeof phase2Schema>;
