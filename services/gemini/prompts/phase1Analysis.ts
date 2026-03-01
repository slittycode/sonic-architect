/**
 * Phase 1 Analysis Prompt
 *
 * Comprehensive audio analysis with local DSP hints as context.
 * Gemini receives the audio file + these hints and returns a full
 * GeminiPhase1Response JSON.
 */

import type { LocalDSPHints } from '@/types';

const SYSTEM_PREAMBLE = `You are analyzing audio for an Ableton Live 12 producer. All device names, parameter names, and workflow suggestions must be specific to Ableton Live 12.

The user wants to understand the sonic character of each element and how to recreate it.`;

/**
 * Build the Phase 1 prompt text.
 * @param hints - Local DSP measurements (BPM, key, spectral, chords, etc.)
 */
export function buildPhase1Prompt(hints: LocalDSPHints): string {
  // Compact the hints (drop large arrays like rmsEnvelope, mfcc to save tokens)
  const compactHints = {
    bpm: hints.bpm,
    bpmConfidence: hints.bpmConfidence,
    key: hints.key,
    keyConfidence: hints.keyConfidence,
    duration: hints.duration,
    sampleRate: hints.sampleRate,
    channelCount: hints.channelCount,
    spectralBands: hints.spectralBands.map((b) => ({
      name: b.name,
      rangeHz: b.rangeHz,
      averageDb: Math.round(b.averageDb * 10) / 10,
      dominance: b.dominance,
    })),
    onsets: hints.onsets.length,
    chordProgression: hints.chordProgression.slice(0, 20).map((c) => ({
      chord: c.chord,
      timeRange: c.timeRange,
      confidence: Math.round(c.confidence * 100) / 100,
    })),
    ...(hints.essentiaFeatures && {
      essentiaFeatures: hints.essentiaFeatures,
    }),
    ...(hints.lufsIntegrated !== undefined && {
      lufsIntegrated: Math.round(hints.lufsIntegrated * 10) / 10,
    }),
    ...(hints.truePeak !== undefined && {
      truePeak: Math.round(hints.truePeak * 10) / 10,
    }),
    ...(hints.stereoCorrelation !== undefined && {
      stereoCorrelation: Math.round(hints.stereoCorrelation * 100) / 100,
    }),
    ...(hints.stereoWidth !== undefined && {
      stereoWidth: Math.round(hints.stereoWidth * 100) / 100,
    }),
    ...(hints.monoCompatible !== undefined && {
      monoCompatible: hints.monoCompatible,
    }),
  };

  return `${SYSTEM_PREAMBLE}

## Local DSP Hints

These are approximate measurements from a local DSP engine. Use them as starting points but trust your own analysis of the audio.

\`\`\`json
${JSON.stringify(compactHints, null, 2)}
\`\`\`

## Task

Listen to the audio carefully and provide a comprehensive reconstruction blueprint. Return a JSON object with this exact structure:

{
  "bpm": <number>,
  "bpmConfidence": <0-1>,
  "key": "<e.g. C minor>",
  "keyConfidence": <0-1>,
  "timeSignature": "<e.g. 4/4>",
  "genre": "<primary genre>",
  "subGenre": "<sub-genre if applicable>",
  "groove": "<e.g. four-on-the-floor, broken beat, swing>",
  "grooveDescription": "<detailed description of the rhythmic feel>",
  "energy": <0-1>,
  "chordProgression": {
    "chords": [{ "chord": "<e.g. Am7>", "startTime": <seconds>, "duration": <seconds> }],
    "summary": "<e.g. i-VI-III-VII progression in Am, typical of melodic techno>"
  },
  "elements": [
    {
      "name": "<e.g. Sub-Bass, Kick, Lead Synth, Pad, Hi-Hats, Vocals>",
      "frequencyRange": "<e.g. 20-80 Hz>",
      "sonicCharacter": "<what it sounds like>",
      "howToRecreate": "<Ableton Live 12 specific instructions>",
      "suggestedDevices": ["<Ableton device names>"],
      "role": "<foundation, rhythm, melody, texture, atmosphere>"
    }
  ],
  "detectedCharacteristics": {
    "sidechain": { "present": <bool>, "description": "<details>", "strength": "<subtle/medium/heavy>" },
    "acidResonance": { "present": <bool>, "description": "<details>" },
    "reverbCharacter": { "present": <bool>, "description": "<details>", "estimatedDecay": "<e.g. 2.5s>" },
    "distortion": { "present": <bool>, "description": "<details>", "type": "<saturation/bitcrush/wavefold>" },
    "supersawLayers": { "present": <bool>, "description": "<details>" },
    "vocalPresence": { "present": <bool>, "description": "<details>", "type": "<lead/chopped/processed/background>" },
    "bassCharacter": { "description": "<details>", "type": "<sub/reese/acid/pluck>" },
    "groove": { "swingAmount": "<percentage or description>", "description": "<groove feel details>" }
  },
  "arrangement": [
    {
      "section": "<intro/buildup/drop/breakdown/verse/chorus/outro>",
      "startTime": <seconds>,
      "endTime": <seconds>,
      "description": "<what happens in this section>",
      "energyLevel": <0-1>
    }
  ],
  "instrumentation": [
    {
      "name": "<instrument name>",
      "type": "<synth/sample/acoustic/vocal>",
      "description": "<sonic description>",
      "abletonDevice": "<full Ableton 12 signal chain, e.g. 'Operator > Saturator > EQ Eight > Reverb', plus key settings: oscillator type/waveform, ADSR values, filter cutoff and resonance, FM ratios, drive/mix amounts, and sidechain routing if this element triggers ducking>"
    }
  ],
  "effectsChain": [
    {
      "name": "<effect name>",
      "type": "<reverb/delay/distortion/filter/compressor/etc>",
      "purpose": "<why it's used>",
      "abletonDevice": "<Ableton device name>",
      "settings": "<key settings to match the sound>"
    }
  ],
  "secretSauce": {
    "technique": "<the defining production technique>",
    "description": "<how it shapes the track's character>",
    "abletonImplementation": "<step-by-step Ableton recreation>"
  },
  "genreAnalysis": {
    "primary": "<primary genre>",
    "secondary": ["<secondary genres>"],
    "confidence": <0-1>,
    "reasoning": "<why this genre classification>"
  }
}

Be thorough and specific. For each instrumentation item, the "abletonDevice" field must include the full signal chain (e.g. "Operator > Saturator > Reverb") AND key parameter values — oscillator waveforms, ADSR envelope times, filter cutoff/resonance, FM ratios, drive/mix percentages, and sidechain routing if applicable. This is the primary field used for Ableton Live 12 recreation. Focus on actionable, copy-paste-ready production advice.`;
}
