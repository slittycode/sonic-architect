import { z } from 'zod';
import type { ReconstructionBlueprint } from '../types';

const TelemetrySchema = z.object({
  bpm: z.string(),
  key: z.string(),
  groove: z.string(),
  bpmConfidence: z.number().optional(),
  keyConfidence: z.number().optional(),
});

const ArrangementSectionSchema = z.object({
  timeRange: z.string(),
  label: z.string(),
  description: z.string(),
});

const InstrumentRackElementSchema = z.object({
  element: z.string(),
  timbre: z.string(),
  frequency: z.string(),
  abletonDevice: z.string(),
});

const FXChainItemSchema = z.object({
  artifact: z.string(),
  recommendation: z.string(),
});

const SecretSauceSchema = z.object({
  trick: z.string(),
  execution: z.string(),
});

const AnalysisMetaSchema = z.object({
  provider: z.string(),
  analysisTime: z.number(),
  sampleRate: z.number(),
  duration: z.number(),
  channels: z.number(),
});

export const BlueprintSchema = z.object({
  telemetry: TelemetrySchema,
  arrangement: z.array(ArrangementSectionSchema),
  instrumentation: z.array(InstrumentRackElementSchema),
  fxChain: z.array(FXChainItemSchema),
  secretSauce: SecretSauceSchema,
  meta: AnalysisMetaSchema.optional(),
});

/**
 * Validate and parse unknown data into a ReconstructionBlueprint.
 * Throws ZodError with detailed field-level messages on failure.
 */
export function validateBlueprint(data: unknown): ReconstructionBlueprint {
  return BlueprintSchema.parse(data) as ReconstructionBlueprint;
}

/**
 * Safe validation — returns { success, data?, error? } instead of throwing.
 */
export function safeParseBluepint(data: unknown) {
  return BlueprintSchema.safeParse(data);
}
