/**
 * V2 Gemini Response Types
 *
 * Re-exports the Zod-inferred types for Phase 1 and Phase 2 responses.
 * The Zod schemas in ../schemas/ are the source of truth; this module
 * provides convenient re-exports for consumers.
 */

export type { GeminiPhase1Response } from '../schemas/phase1Schema';
export type { GeminiPhase2Additions } from '../schemas/phase2Schema';
export { phase1Schema } from '../schemas/phase1Schema';
export { phase2Schema } from '../schemas/phase2Schema';
