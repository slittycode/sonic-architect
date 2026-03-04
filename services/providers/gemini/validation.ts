import type { LocalDSPHints } from '../../../types';
import { phase1Schema, type GeminiPhase1Response } from '../../gemini/schemas/phase1Schema';
import { phase2Schema, type GeminiPhase2Additions } from '../../gemini/schemas/phase2Schema';

export function parsePhase1Response(raw: string, hints: LocalDSPHints): GeminiPhase1Response {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    let repaired = cleaned;
    const opens = (repaired.match(/[{[]/g) || []).length;
    const closes = (repaired.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      repaired += repaired.lastIndexOf('[') > repaired.lastIndexOf('{') ? ']' : '}';
    }
    parsed = JSON.parse(repaired);
  }

  const result = phase1Schema.safeParse(parsed);
  if (result.success) return result.data;

  console.warn(
    '[GeminiProvider] Phase 1 Zod validation failed, using field-level fallbacks:',
    result.error.issues.slice(0, 5)
  );

  const forced = phase1Schema.parse(parsed ?? {});
  if (!forced.bpm || forced.bpm === 120) {
    forced.bpm = hints.bpm;
    forced.bpmConfidence = hints.bpmConfidence;
  }
  if (!forced.key || forced.key === 'C major') {
    forced.key = hints.key;
    forced.keyConfidence = hints.keyConfidence;
  }

  return forced;
}

export function parsePhase2Response(raw: string): GeminiPhase2Additions {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    let repaired = cleaned;
    const opens = (repaired.match(/[{[]/g) || []).length;
    const closes = (repaired.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      repaired += repaired.lastIndexOf('[') > repaired.lastIndexOf('{') ? ']' : '}';
    }
    parsed = JSON.parse(repaired);
  }

  const result = phase2Schema.safeParse(parsed);
  if (result.success) return result.data;

  console.warn(
    '[GeminiProvider] Phase 2 Zod validation failed, using field-level fallbacks:',
    result.error.issues.slice(0, 5)
  );
  return phase2Schema.parse(parsed ?? {});
}
