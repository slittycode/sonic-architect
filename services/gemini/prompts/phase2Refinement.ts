/**
 * Phase 2 Refinement Prompt — Actionable Synthesis Pass
 *
 * Receives the audio again + Phase 1 detection results + local DSP hints.
 * Phase 2 is the "hands": turn Phase 1's exhaustive detection into a
 * concrete, parameter-level Ableton Live 12 recreation blueprint.
 */

import type { LocalDSPHints } from '@/types';
import type { GeminiPhase1Response } from '../schemas/phase1Schema';

const SYSTEM_PREAMBLE = `You are a senior Ableton Live 12 sound designer and mix engineer. You've just received a detailed sonic inventory (Phase 1) of a track, along with the audio itself and DSP measurements. Your job is to turn this inventory into an actionable recreation blueprint.

Every device name, parameter name, and workflow suggestion MUST be specific to Ableton Live 12.

Focus on PRECISION: exact parameter values, specific signal chains, real device names, and copy-paste-ready production advice.`;

/**
 * Build the Phase 2 refinement prompt.
 * @param phase1 - Validated Phase 1 response
 * @param hints  - Local DSP measurements
 */
export function buildPhase2Prompt(phase1: GeminiPhase1Response, hints: LocalDSPHints): string {
  // Compact hints
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

  // Build a compact element list from Phase 1 for the prompt
  const elementSummary = (phase1.elements || [])
    .map((e, i) => `${i + 1}. ${e.name} (${e.role || 'unknown role'}) — ${e.sonicCharacter || e.frequencyRange || ''}`)
    .join('\n');

  return `${SYSTEM_PREAMBLE}

## Phase 1 Detection Results

Phase 1 identified the following sonic elements, arrangement, and characteristics. Use this as your starting point — every element listed below needs a full Ableton device chain.

### Elements Detected
${elementSummary || '(no elements detected — listen carefully and identify them yourself)'}

### Full Phase 1 Data
\`\`\`json
${JSON.stringify(phase1, null, 2)}
\`\`\`

## Local DSP Measurements

\`\`\`json
${JSON.stringify(compactHints, null, 2)}
\`\`\`

## Task — Actionable Recreation Blueprint

Listen to the audio again with Phase 1's detection in front of you. Your goal is to produce a COMPLETE Ableton Live 12 recreation blueprint with parameter-level precision.

### Instructions:

1. **Instrumentation** — For EVERY element identified in Phase 1, produce a full signal chain:
   - The Ableton device to start with (Operator, Wavetable, Analog, Simpler, Drum Rack, etc.)
   - Full signal chain in order (e.g. "Operator → Auto Filter → Saturator → Reverb → Utility")
   - Specific parameter values: oscillator waveforms, ADSR times, filter cutoff/resonance/type, FM ratios, drive amounts, mix percentages
   - Preset suggestions if a stock preset is close
   - How this element sits in the mix (panning, volume level relative to kick)

2. **Effects Chain** — Global and send effects:
   - Each effect with its Ableton device name and exact settings
   - Sidechain routing details (source, ratio, attack/release)
   - Send effect levels per instrument

3. **Secret Sauce** — The ONE technique that defines this track's character:
   - Step-by-step Ableton implementation
   - Exact device chain with parameter values
   - Why it matters for the track's identity

4. **Mix Feedback** — Spectral balance assessment:
   - Compare against genre norms
   - Low/mid/high balance observations with specific dB adjustments
   - Stereo image advice
   - Dynamics/compression character

5. **BPM/Key Corrections** — Only if Phase 1 got them wrong (>50% confidence):
   - Provide corrected value with reasoning
   - Set to null if Phase 1 values are correct

6. **Production Insights** — Advanced techniques observed:
   - Synthesis methods, mixing approaches, arrangement tricks
   - Specific Ableton implementation for each

Return a JSON object with this exact structure:

{
  "instrumentation": [
    {
      "name": "<element name from Phase 1>",
      "type": "<synth/sample/acoustic/vocal/drum-machine>",
      "description": "<refined sonic description>",
      "abletonDevice": "<primary device>",
      "deviceChain": "<full signal chain, e.g. 'Operator → Auto Filter (LP24, 1.2kHz, Res 40%) → Saturator (Analog Clip, Drive 8dB) → Reverb (Plate, 2.1s, Dry/Wet 22%)'>",
      "presetSuggestion": "<closest stock preset, or 'Init' if building from scratch>",
      "parameterNotes": "<detailed parameter values: oscillator config, ADSR, filter, modulation>"
    }
  ],
  "effectsChain": [
    {
      "name": "<effect name, e.g. 'Master Bus Compression', 'Send A: Hall Reverb'>",
      "type": "<reverb/delay/distortion/filter/compressor/chorus/phaser/limiter/etc>",
      "purpose": "<what sonic role it plays>",
      "abletonDevice": "<device name>",
      "settings": "<precise settings, e.g. 'Glue Compressor: Threshold -18dB, Ratio 4:1, Attack 10ms, Release 100ms, Makeup 3dB, Dry/Wet 100%'>"
    }
  ],
  "secretSauce": {
    "technique": "<the single most defining production technique>",
    "description": "<how it shapes the track's character>",
    "abletonImplementation": "<step-by-step recreation with exact device chain and parameters>"
  },
  "mixFeedback": {
    "overallBalance": "<overall mix assessment relative to genre norms>",
    "lowEnd": "<low frequency observations — specific dB/frequency suggestions>",
    "midRange": "<mid frequency observations — specific dB/frequency suggestions>",
    "highEnd": "<high frequency observations — specific dB/frequency suggestions>",
    "stereoImage": "<stereo field assessment — width, mono compatibility, panning>",
    "dynamics": "<dynamics/compression character — loudness, transient shape, pumping>",
    "recommendations": ["<specific actionable mixing suggestions with dB values and frequency ranges>"]
  },
  "productionInsights": [
    {
      "category": "<mixing/synthesis/arrangement/mastering/sound-design>",
      "insight": "<production technique observation>",
      "abletonImplementation": "<how to implement in Ableton Live 12 with specific devices and settings>"
    }
  ],
  "sonicSummary": "<2-3 sentences: the track's vibe, production style, and defining sonic qualities>",
  "arrangementNotes": "<any corrections or additions to Phase 1's arrangement sections>",
  "bpmCorrection": null,
  "keyCorrection": null
}

### PRECISION STANDARD:
- WRONG: "Set the filter to a medium frequency"
- RIGHT: "Auto Filter: LP 24, Frequency 2.4 kHz, Resonance 35%, Envelope Amount 60%, LFO Rate 1/4"
- WRONG: "Add some reverb"
- RIGHT: "Reverb: Hall, Decay 3.2s, Pre-Delay 22ms, High Cut 8kHz, Low Cut 200Hz, Dry/Wet 28%, Stereo 120%"
- WRONG: "Use Operator for the bass"
- RIGHT: "Operator: Osc A Sine, Coarse 1, Fine 0, Level 100%. Osc B Sine, Coarse 2, Fine 0, Level 40% (FM from A). Filter LP24 at 800Hz, Res 15%. Amp Env: A 0ms, D 200ms, S 80%, R 150ms. Glide On, Time 30ms."

### IMPORTANT:
- Create an instrumentation entry for EVERY element Phase 1 detected — do not skip any.
- The deviceChain field should be a readable signal flow with key parameters inline.
- Set bpmCorrection and keyCorrection to null if Phase 1 values are correct.
- Focus on parameter values a producer can directly dial in.`;
}
