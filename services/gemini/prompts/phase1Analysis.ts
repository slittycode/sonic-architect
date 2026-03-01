/**
 * Phase 1 Analysis Prompt — Detection Pass
 *
 * Phase 1 is the "ears": exhaustive identification of every sonic element,
 * chord change, arrangement section, and production characteristic.
 * No detailed Ableton device chains here — that's Phase 2's job.
 */

import type { LocalDSPHints } from '@/types';

const SYSTEM_PREAMBLE = `You are a world-class audio analysis engine. Your job is to listen to the audio and identify EVERYTHING you hear — every sonic element, every chord change, every section, every production characteristic. Be exhaustive and precise.

You are NOT giving production advice yet. That comes later. Right now, focus entirely on DETECTION and DESCRIPTION.

## MANDATORY RULES — READ BEFORE ANALYZING

These rules are NON-NEGOTIABLE. If your response violates any of them, it will be rejected:

1. **MINIMUM 8 ELEMENTS.** You must identify at least 8 distinct sonic elements. Most tracks have 10-15. If you return fewer than 8, you have not listened carefully enough.

2. **VOCALS ARE MANDATORY TO CHECK.** Read the track title and artist name. If there is ANY singing, vocal chops, spoken word, or processed vocal texture, you MUST list each as a separate element. Do NOT default to "instrumental" without careful listening. The track "Lika Star - Вспоминай" obviously contains vocals — ignoring them is a critical failure.

3. **PERCUSSION MUST BE ITEMIZED.** List EACH percussion element separately: kick, snare/clap, closed hi-hat, open hi-hat, ride, crash, shaker, tambourine, percussion loops. Do NOT collapse them into a single "drums" element.

4. **CHORD PROGRESSIONS MUST HAVE MULTIPLE ENTRIES.** If the track has a chord loop (most do), list each chord change with its timestamp. Only return a single chord if the track is truly a one-chord drone with zero harmonic movement.

5. **SCAN ALL FREQUENCY BANDS.** Systematically check:
   - Sub/Bass (20-200 Hz): kick, sub-bass, bass synth
   - Low-Mid (200-800 Hz): bass body, warm pads, lower vocals, toms
   - Mid (800-2500 Hz): lead synths, chord stabs, vocal body, snare body
   - High-Mid (2.5-6 kHz): vocal presence, synth brightness, snare crack
   - High (6-20 kHz): hi-hats, cymbals, rides, sibilance, white noise, air

6. **USE THE TRACK TITLE FOR CLUES.** The title and artist name often indicate genre, language, and content. "Hard Progressive Mix" means hard progressive — not dub techno. A Russian artist name with a Russian title suggests Russian-language vocals.`;

/**
 * Build the Phase 1 prompt text.
 * @param hints - Local DSP measurements (BPM, key, spectral, chords, etc.)
 */
export function buildPhase1Prompt(hints: LocalDSPHints): string {
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

These are approximate measurements from a local DSP engine. Use them as starting points but trust your own ears over these values.

\`\`\`json
${JSON.stringify(compactHints, null, 2)}
\`\`\`

## Response Format

Return a JSON object with this exact structure:

{
  "bpm": <number>,
  "bpmConfidence": <0-1>,
  "key": "<e.g. C minor>",
  "keyConfidence": <0-1>,
  "timeSignature": "<e.g. 4/4>",
  "genre": "<primary genre — use track title for clues>",
  "subGenre": "<sub-genre if applicable>",
  "groove": "<e.g. four-on-the-floor, broken beat, swing>",
  "grooveDescription": "<detailed description of the rhythmic feel>",
  "energy": <0-1>,
  "chordProgression": {
    "chords": [{ "chord": "<e.g. Am7>", "startTime": <seconds>, "duration": <seconds> }],
    "summary": "<progression description with Roman numerals>"
  },
  "elements": [
    {
      "name": "<specific name, e.g. 'Closed Hi-Hat', 'Lead Vocal', 'Filtered Pad'>",
      "frequencyRange": "<e.g. 8000-12000 Hz>",
      "sonicCharacter": "<detailed: timbre, texture, tone, what it reminds you of>",
      "howToRecreate": "<basic synthesis/sampling approach>",
      "suggestedDevices": ["<Ableton Live 12 device names>"],
      "role": "<foundation/rhythm/melody/texture/atmosphere/vocal/fx>"
    }
  ],
  "detectedCharacteristics": {
    "sidechain": { "present": <bool>, "description": "<details>", "strength": "<subtle/medium/heavy>" },
    "acidResonance": { "present": <bool>, "description": "<details>" },
    "reverbCharacter": { "present": <bool>, "description": "<type, tone, decay>", "estimatedDecay": "<e.g. 2.5s>" },
    "distortion": { "present": <bool>, "description": "<details>", "type": "<saturation/bitcrush/wavefold/overdrive>" },
    "supersawLayers": { "present": <bool>, "description": "<details>" },
    "vocalPresence": { "present": <bool>, "description": "<vocal type, register, processing>", "type": "<lead/chopped/processed/background/none>" },
    "bassCharacter": { "description": "<bass tone and behavior>", "type": "<sub/reese/acid/pluck/808/fm>" },
    "groove": { "swingAmount": "<percentage or description>", "description": "<groove feel>" }
  },
  "arrangement": [
    {
      "section": "<intro/verse/chorus/buildup/drop/breakdown/bridge/outro>",
      "startTime": <seconds>,
      "endTime": <seconds>,
      "description": "<which elements enter, exit, change>",
      "energyLevel": <0-1>
    }
  ],
  "instrumentation": [
    {
      "name": "<instrument/sound name>",
      "type": "<synth/sample/acoustic/vocal/drum-machine>",
      "description": "<what it sounds like and its role>",
      "abletonDevice": "<likely Ableton device>"
    }
  ],
  "effectsChain": [
    {
      "name": "<effect heard>",
      "type": "<reverb/delay/distortion/filter/compressor/chorus/phaser/etc>",
      "purpose": "<what sonic role it plays>",
      "abletonDevice": "<likely Ableton device>",
      "settings": "<approximate settings you can hear>"
    }
  ],
  "secretSauce": {
    "technique": "<the single most defining production technique>",
    "description": "<how it shapes the track's character>",
    "abletonImplementation": "<basic approach — detailed recreation in Phase 2>"
  },
  "genreAnalysis": {
    "primary": "<primary genre>",
    "secondary": ["<secondary genres>"],
    "confidence": <0-1>,
    "reasoning": "<why this classification, referencing sonic evidence AND the track title>"
  }
}

## FINAL CHECKLIST — Verify before responding:

□ Did I list at least 8 elements?
□ Did I check for vocals? (Read the artist/title: does it suggest singing?)
□ Did I list hi-hats, cymbals, and percussion separately?
□ Did I list multiple chord changes with timestamps?
□ Did I check all 5 frequency bands for content?
□ Does my genre match what the track title suggests?
□ Are my sonicCharacter descriptions specific (not generic)?`;
}
