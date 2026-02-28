/**
 * AudioAnalysisResult — the structured output of Phase 1 Gemini audio analysis.
 *
 * This is the complete typed schema that Gemini returns after listening to
 * the audio. It covers temporal, tonal, spectral, presence, genre, and
 * production characteristics. Phase 2 (device chain generation) consumes
 * this object alongside local DSP telemetry.
 */

export interface AudioAnalysisResult {
  bpm: {
    value: number;
    confidence: 'low' | 'medium' | 'high';
    /** Groove pattern detected in the audio */
    groovePattern: 'straight' | 'swing' | 'shuffle' | 'broken';
  };
  timeSignature: {
    beats: number;
    noteValue: number;
  };
  key: {
    root: string;
    scale: 'major' | 'minor' | 'modal';
    confidence: 'low' | 'medium' | 'high';
  };
  /** Chord progression summary, e.g. "i-VII-VI-VII in C minor" */
  chords?: string;
  tonalComplexity: 'simple' | 'complex' | 'atonal';
  spectralCharacteristics: {
    brightness: 'dark' | 'warm' | 'bright' | 'harsh';
    bassWeight: 'sub' | 'kick' | 'punchy' | 'light';
    stereoWidth: 'mono' | 'narrow' | 'wide' | 'extreme';
  };
  presenceOf: {
    reverb: boolean;
    delay: boolean;
    sidechain: boolean;
    distortion: boolean;
    acidResonance: boolean;
    vinylTexture: boolean;
    tapeSaturation: boolean;
    fieldRecordings: boolean;
  };
  /** Perceived energy level 1–10 */
  energyLevel: number;
  /** Top genre matches in confidence order. Open-ended — not a fixed list. */
  genreAffinity: Array<{
    genre: string;
    confidence: number;
  }>;
  productionEra:
    | 'vintage70s'
    | 'vintage80s'
    | 'vintage90s'
    | '2000s'
    | 'modern'
    | 'contemporary';
  perceivedDensity: 'sparse' | 'moderate' | 'dense' | 'wallOfSound';
  dynamicRange: 'compressed' | 'moderate' | 'dynamic';
  /** Optional production-specific notes from Gemini */
  productionNotes?: string;
}

// ---------------------------------------------------------------------------
// Runtime validator — no zod dependency; mirrors parseGeminiEnhancement pattern
// ---------------------------------------------------------------------------

/**
 * Lightweight runtime guard for AudioAnalysisResult.
 * Checks required top-level fields and types; returns null if malformed.
 */
export function validateAudioAnalysisResult(raw: unknown): AudioAnalysisResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  // bpm
  if (!r.bpm || typeof r.bpm !== 'object') return null;
  const bpm = r.bpm as Record<string, unknown>;
  if (typeof bpm.value !== 'number' || isNaN(bpm.value) || bpm.value <= 0) return null;
  if (!['low', 'medium', 'high'].includes(bpm.confidence as string)) return null;
  if (!['straight', 'swing', 'shuffle', 'broken'].includes(bpm.groovePattern as string))
    return null;

  // key
  if (!r.key || typeof r.key !== 'object') return null;
  const key = r.key as Record<string, unknown>;
  if (typeof key.root !== 'string' || !key.root.trim()) return null;
  if (!['major', 'minor', 'modal'].includes(key.scale as string)) return null;

  // spectralCharacteristics
  if (!r.spectralCharacteristics || typeof r.spectralCharacteristics !== 'object') return null;
  const spec = r.spectralCharacteristics as Record<string, unknown>;
  if (!['dark', 'warm', 'bright', 'harsh'].includes(spec.brightness as string)) return null;
  if (!['sub', 'kick', 'punchy', 'light'].includes(spec.bassWeight as string)) return null;
  if (!['mono', 'narrow', 'wide', 'extreme'].includes(spec.stereoWidth as string)) return null;

  // presenceOf
  if (!r.presenceOf || typeof r.presenceOf !== 'object') return null;
  const p = r.presenceOf as Record<string, unknown>;
  const presenceKeys: (keyof AudioAnalysisResult['presenceOf'])[] = [
    'reverb',
    'delay',
    'sidechain',
    'distortion',
    'acidResonance',
    'vinylTexture',
    'tapeSaturation',
    'fieldRecordings',
  ];
  for (const k of presenceKeys) {
    if (typeof p[k] !== 'boolean') return null;
  }

  // energyLevel
  if (typeof r.energyLevel !== 'number' || r.energyLevel < 1 || r.energyLevel > 10) return null;

  // genreAffinity
  if (!Array.isArray(r.genreAffinity) || r.genreAffinity.length === 0) return null;
  for (const item of r.genreAffinity as unknown[]) {
    if (!item || typeof item !== 'object') return null;
    const g = item as Record<string, unknown>;
    if (typeof g.genre !== 'string' || !g.genre.trim()) return null;
    if (typeof g.confidence !== 'number') return null;
  }

  // productionEra
  const validEras = ['vintage70s', 'vintage80s', 'vintage90s', '2000s', 'modern', 'contemporary'];
  if (!validEras.includes(r.productionEra as string)) return null;

  // perceivedDensity
  if (
    !['sparse', 'moderate', 'dense', 'wallOfSound'].includes(r.perceivedDensity as string)
  )
    return null;

  // dynamicRange
  if (!['compressed', 'moderate', 'dynamic'].includes(r.dynamicRange as string)) return null;

  return raw as AudioAnalysisResult;
}
