/**
 * Phase 2 Refinement Prompt
 *
 * Receives the audio again + Phase 1 results + local DSP hints.
 * Focuses on deeper analysis, mix feedback, corrections, and enrichments.
 */

import type { LocalDSPHints } from '@/types';
import type { GeminiPhase1Response } from '../schemas/phase1Schema';

const SYSTEM_PREAMBLE = `You are analyzing audio for an Ableton Live 12 producer. All device names, parameter names, and workflow suggestions must be specific to Ableton Live 12.

The user wants to understand the sonic character of each element and how to recreate it.`;

/**
 * Build the Phase 2 refinement prompt.
 * @param phase1 - Validated Phase 1 response
 * @param hints  - Local DSP measurements
 */
export function buildPhase2Prompt(phase1: GeminiPhase1Response, hints: LocalDSPHints): string {
  // Compact hints (same as Phase 1)
  const compactHints = {
    bpm: hints.bpm,
    bpmConfidence: hints.bpmConfidence,
    key: hints.key,
    keyConfidence: hints.keyConfidence,
    duration: hints.duration,
    lufsIntegrated: hints.lufsIntegrated,
    truePeak: hints.truePeak,
    stereoCorrelation: hints.stereoCorrelation,
    stereoWidth: hints.stereoWidth,
    monoCompatible: hints.monoCompatible,
    spectralBands: hints.spectralBands.map((b) => ({
      name: b.name,
      averageDb: Math.round(b.averageDb * 10) / 10,
      dominance: b.dominance,
    })),
  };

  return `${SYSTEM_PREAMBLE}

## Phase 1 Analysis Results

This is the initial analysis from the first pass. Review it while listening to the audio again.

\`\`\`json
${JSON.stringify(phase1, null, 2)}
\`\`\`

## Local DSP Measurements

\`\`\`json
${JSON.stringify(compactHints, null, 2)}
\`\`\`

## Task

Listen to the audio again with the Phase 1 analysis in front of you. Only override Phase 1 values if you are more than 50% confident the original value is incorrect. Document any corrections with your reasoning and confidence level.

Return a JSON object with this exact structure:

{
  "mixFeedback": {
    "overallBalance": "<overall mix assessment>",
    "lowEnd": "<low frequency observations and advice>",
    "midRange": "<mid frequency observations and advice>",
    "highEnd": "<high frequency observations and advice>",
    "stereoImage": "<stereo field assessment>",
    "dynamics": "<dynamics/compression assessment>",
    "recommendations": ["<specific actionable suggestions>"]
  },
  "refinedInstrumentation": [
    {
      "name": "<matching name from Phase 1 instrumentation>",
      "refinedDescription": "<enhanced sonic description>",
      "detailedDeviceChain": ["<detailed Ableton device chain>"],
      "parameterDetails": "<specific parameter values and ranges>",
      "layeringNotes": "<how this element sits in the mix>"
    }
  ],
  "arrangementNotes": "<corrections or additions to Phase 1 arrangement sections>",
  "productionInsights": [
    {
      "category": "<mixing/synthesis/arrangement/mastering/sound-design>",
      "insight": "<production technique observation>",
      "abletonImplementation": "<how to implement in Ableton Live 12>"
    }
  ],
  "sonicSummary": "<overall sonic character summary — 2-3 sentences describing the track's vibe, production style, and defining qualities>",
  "bpmCorrection": {
    "correctedBpm": <number or omit if Phase 1 BPM is correct>,
    "confidence": <0-1>,
    "reasoning": "<why the correction is needed>"
  },
  "keyCorrection": {
    "correctedKey": "<corrected key or omit if Phase 1 key is correct>",
    "confidence": <0-1>,
    "reasoning": "<why the correction is needed>"
  }
}

Focus on:
1. **Verify** BPM, key, genre — only override if >50% confident Phase 1 was wrong
2. **Enrich** all descriptive text — make howToRecreate more specific, add parameter values
3. **Add** anything Phase 1 missed — additional sonic elements, effects, arrangement nuances
4. **Provide mix feedback** — assess spectral balance, stereo field, dynamics relative to the identified genre
5. **Ensure Ableton Live 12 accuracy** — correct any device names, parameter names, or workflow suggestions

Be precise with parameter values. Instead of "set the filter to a medium frequency", say "Auto Filter: LP 24, Frequency 2.4 kHz, Resonance 35%, Envelope Amount 60%".`;
}
