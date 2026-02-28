/**
 * Phase 1 Prompt — Audio Analysis
 *
 * Instructs Gemini to perform comprehensive structured audio analysis.
 * Local BPM/key are provided as reference hints only; Gemini is asked to
 * assess independently and flag disagreements via its confidence fields.
 *
 * Returns ONLY valid JSON matching AudioAnalysisResult — no markdown,
 * no explanation, no trailing text.
 */

/**
 * Build the Phase 1 audio analysis prompt.
 *
 * @param localBpm  BPM value from local DSP (provided as a reference hint)
 * @param localKey  Key string from local DSP (provided as a reference hint)
 * @param chordSummary  Optional chord progression summary from local analysis
 */
export function buildAudioAnalysisPrompt(
  localBpm: string,
  localKey: string,
  chordSummary?: string
): string {
  const lines = [
    'You are a professional audio analyst and musicologist.',
    'Listen carefully to the audio and return a comprehensive structured analysis as JSON.',
    '',
    'LOCAL DSP REFERENCE (provided as hints only — assess independently):',
    `  BPM hint: ${localBpm}`,
    `  Key hint: ${localKey}`,
  ];

  if (chordSummary) {
    lines.push(`  Chord hint: ${chordSummary}`);
  }

  lines.push(
    '',
    'INSTRUCTIONS:',
    '- Assess BPM, key, and groove independently by listening to the audio.',
    '- If you agree with the hint, set confidence to "high".',
    '- If you slightly disagree, set confidence to "medium" and use your own estimate.',
    '- If you strongly disagree, set confidence to "low" and use your own estimate.',
    '- For genreAffinity: provide your top 3 best-match genres with confidence 0.0–1.0.',
    '  Use specific genre names (e.g. "minimal techno", "deep house", "drum and bass").',
    '  Do NOT limit yourself to a fixed list — use your own knowledge.',
    '',
    'EDGE CASES:',
    '- Ambient/drone: BPM confidence should be "low", groovePattern "straight".',
    '- Noise/industrial/atonal: set tonalComplexity to "atonal".',
    '- No swing detected: groovePattern must be "straight".',
    '- If field recordings present (nature, city, crowds): presenceOf.fieldRecordings = true.',
    '',
    'Return ONLY valid JSON — no markdown fences, no explanation, no extra text.',
    'The JSON must match this exact schema:',
    '{',
    '  "bpm": {',
    '    "value": <number — your BPM estimate>,',
    '    "confidence": "low|medium|high",',
    '    "groovePattern": "straight|swing|shuffle|broken"',
    '  },',
    '  "timeSignature": { "beats": <number>, "noteValue": <number> },',
    '  "key": {',
    '    "root": "<note name, e.g. C, F#, Bb>",',
    '    "scale": "major|minor|modal",',
    '    "confidence": "low|medium|high"',
    '  },',
    '  "chords": "<optional progression summary, e.g. i-VII-VI-VII>",',
    '  "tonalComplexity": "simple|complex|atonal",',
    '  "spectralCharacteristics": {',
    '    "brightness": "dark|warm|bright|harsh",',
    '    "bassWeight": "sub|kick|punchy|light",',
    '    "stereoWidth": "mono|narrow|wide|extreme"',
    '  },',
    '  "presenceOf": {',
    '    "reverb": <boolean>,',
    '    "delay": <boolean>,',
    '    "sidechain": <boolean — audible pumping/ducking>,',
    '    "distortion": <boolean — saturation or hard clipping>,',
    '    "acidResonance": <boolean — 303-style resonant filter sweep>,',
    '    "vinylTexture": <boolean — crackle, warmth, tape hiss>,',
    '    "tapeSaturation": <boolean — analogue warmth, gentle harmonics>,',
    '    "fieldRecordings": <boolean — natural or environmental sounds>',
    '  },',
    '  "energyLevel": <integer 1–10>,',
    '  "genreAffinity": [',
    '    { "genre": "<specific genre name>", "confidence": <0.0–1.0> },',
    '    { "genre": "<second genre>", "confidence": <0.0–1.0> },',
    '    { "genre": "<third genre>", "confidence": <0.0–1.0> }',
    '  ],',
    '  "productionEra": "vintage70s|vintage80s|vintage90s|2000s|modern|contemporary",',
    '  "perceivedDensity": "sparse|moderate|dense|wallOfSound",',
    '  "dynamicRange": "compressed|moderate|dynamic",',
    '  "productionNotes": "<optional: 1–2 sentences of specific technical observations>"',
    '}',
  );

  return lines.join('\n');
}
