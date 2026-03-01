/**
 * Phase 2 Prompt — Device Chain Generation
 *
 * Text-only, no audio. Receives rich context from BOTH local DSP telemetry
 * AND Phase 1 AudioAnalysisResult. Produces Ableton device chain descriptions,
 * instrumentation timbre notes, and the Secret Sauce technique.
 *
 * Returns the same JSON shape as the original enhancement prompt so that
 * parseGeminiEnhancement() and mergeGeminiEnhancement() work unchanged.
 */

import { ReconstructionBlueprint } from '../../../types';
import { AudioAnalysisResult } from '../types/analysis';

/**
 * Build the Phase 2 device-chain generation prompt.
 *
 * @param blueprint  Blueprint after Phase 1 merge (includes updated telemetry)
 * @param analysis   AudioAnalysisResult from Phase 1 (may be null if Phase 1 failed)
 */
export function buildDeviceChainsPrompt(
  blueprint: ReconstructionBlueprint,
  analysis: AudioAnalysisResult | null
): string {
  const t = blueprint.telemetry;
  const lines = [
    'You are an Ableton Live 12 production expert.',
    'Generate detailed device chains, timbre descriptions, and production techniques',
    'based on the comprehensive signal analysis below.',
    '',
    '═══════════════════════════════════',
    'SIGNAL ANALYSIS CONTEXT',
    '═══════════════════════════════════',
  ];

  // Gemini Phase 1 data (richest signal context)
  if (analysis) {
    const genre = analysis.genreAffinity[0]?.genre ?? 'unknown';
    const secondGenre = analysis.genreAffinity[1]?.genre;
    lines.push(
      `Genre: ${genre}${secondGenre ? ` / ${secondGenre}` : ''}`,
      `BPM: ${analysis.bpm.value} (${analysis.bpm.groovePattern}) | Key: ${analysis.key.root} ${analysis.key.scale}`,
      `Energy: ${analysis.energyLevel}/10 | Era: ${analysis.productionEra}`,
      `Density: ${analysis.perceivedDensity} | Dynamic range: ${analysis.dynamicRange}`,
      `Tonal complexity: ${analysis.tonalComplexity}`,
      `Brightness: ${analysis.spectralCharacteristics.brightness} | Bass weight: ${analysis.spectralCharacteristics.bassWeight} | Width: ${analysis.spectralCharacteristics.stereoWidth}`,
      '',
      'Presence flags:',
      `  Sidechain pump: ${analysis.presenceOf.sidechain}`,
      `  Reverb: ${analysis.presenceOf.reverb} | Delay: ${analysis.presenceOf.delay}`,
      `  Distortion: ${analysis.presenceOf.distortion} | Acid resonance: ${analysis.presenceOf.acidResonance}`,
      `  Vinyl texture: ${analysis.presenceOf.vinylTexture} | Tape saturation: ${analysis.presenceOf.tapeSaturation}`,
      `  Field recordings: ${analysis.presenceOf.fieldRecordings}`,
    );
    if (analysis.productionNotes) {
      lines.push(`Production notes: ${analysis.productionNotes}`);
    }
  }

  // Local DSP telemetry (measured values)
  lines.push(
    '',
    '═══════════════════════════════════',
    'LOCAL DSP MEASUREMENTS',
    '═══════════════════════════════════',
    `BPM: ${t.bpm} | Key: ${t.key}`,
  );

  if (t.sidechainAnalysis) {
    lines.push(
      `Sidechain: ${t.sidechainAnalysis.hasSidechain ? `detected (strength ${t.sidechainAnalysis.strength.toFixed(2)})` : 'not detected'}`
    );
  }
  if (t.bassAnalysis) {
    lines.push(
      `Bass decay: ${t.bassAnalysis.decayMs}ms (${t.bassAnalysis.type}), transient ratio ${t.bassAnalysis.transientRatio.toFixed(2)}`
    );
  }
  if (t.acidAnalysis) {
    lines.push(
      `Acid/303: ${t.acidAnalysis.isAcid ? `detected (confidence ${t.acidAnalysis.confidence.toFixed(2)}, resonance ${t.acidAnalysis.resonanceLevel.toFixed(2)})` : 'not detected'}`
    );
  }
  if (t.reverbAnalysis) {
    lines.push(
      `Reverb: ${t.reverbAnalysis.isWet ? `wet (RT60 ${t.reverbAnalysis.rt60.toFixed(2)}s, tail ${t.reverbAnalysis.tailEnergyRatio.toFixed(2)})` : 'dry'}`
    );
  }
  if (t.kickAnalysis) {
    lines.push(
      `Kick: ${t.kickAnalysis.isDistorted ? `distorted (THD ${t.kickAnalysis.thd.toFixed(2)})` : 'clean'}, harmonic ratio ${t.kickAnalysis.harmonicRatio.toFixed(2)}`
    );
  }
  if (t.swingAnalysis) {
    lines.push(`Swing: ${t.swingAnalysis.swingPercent}% (${t.swingAnalysis.grooveType})`);
  }
  if (t.supersawAnalysis) {
    lines.push(
      `Supersaw: ${t.supersawAnalysis.isSupersaw ? `detected (${t.supersawAnalysis.voiceCount} voices, confidence ${t.supersawAnalysis.confidence.toFixed(2)})` : 'not detected'}`
    );
  }
  if (t.vocalAnalysis) {
    lines.push(
      `Vocals: ${t.vocalAnalysis.hasVocals ? `present (confidence ${t.vocalAnalysis.confidence.toFixed(2)})` : 'instrumental'}`
    );
  }
  if (blueprint.chordProgressionSummary) {
    lines.push(`Chords: ${blueprint.chordProgressionSummary}`);
  }

  // Conditional instructions based on detected signals
  lines.push(
    '',
    '═══════════════════════════════════',
    'CONDITIONAL DEVICE CHAIN RULES',
    '═══════════════════════════════════',
  );

  const hasAcid =
    (analysis?.presenceOf.acidResonance ?? false) || (t.acidAnalysis?.isAcid ?? false);
  const hasSidechain =
    (analysis?.presenceOf.sidechain ?? false) || (t.sidechainAnalysis?.hasSidechain ?? false);
  const hasDistortion =
    (analysis?.presenceOf.distortion ?? false) || (t.kickAnalysis?.isDistorted ?? false);
  const hasReverb =
    (analysis?.presenceOf.reverb ?? false) || (t.reverbAnalysis?.isWet ?? false);

  if (hasAcid) {
    lines.push(
      '• Acid/303 resonance detected → include 303-style filter automation in relevant elements.',
      '  Device: Wavetable or Operator as oscillator → Auto Filter (bandpass, resonance 60–90%) → LFO automation.',
    );
  }
  if (hasSidechain) {
    lines.push(
      '• Sidechain pump detected → route sidechain compression explicitly in fxChain.',
      '  Device: Compressor (sidechain input from kick channel, threshold −18dB, ratio 4:1, attack 1ms, release 80ms).',
    );
  }
  if (hasDistortion) {
    lines.push(
      '• Distortion detected → include saturation/overdrive chain.',
      '  Device: Saturator (Soft Clip or Sine curve, drive 30–50%) → EQ Eight (cut mud below 200Hz).',
    );
  }
  if (hasReverb) {
    lines.push(
      '• Reverb detected → include return channel reverb chain.',
      '  Device: Return track — Hybrid Reverb (convolution room + algorithmic shimmer, decay matched to RT60).',
    );
  }

  // Core generation instructions
  lines.push(
    '',
    '═══════════════════════════════════',
    'GENERATION INSTRUCTIONS',
    '═══════════════════════════════════',
    'For each instrumentation element, provide in "abletonDevice":',
    '  1. Full Ableton 12 device chain (e.g. "Operator > Saturator > Reverb")',
    '  2. Key parameter settings (FM ratios, ADSR values, drive/mix amounts)',
    '  3. Sidechain routing if this element triggers or receives ducking',
    '',
    'For each instrumentation element, provide in "timbre":',
    '  1. Synthesis method (subtractive, FM, wavetable, sampler, granular)',
    '  2. Approximate MIDI note range (e.g. "C2–C5")',
    '  3. Key patch descriptors for recreation in Vital or Ableton Operator',
    '',
    'For fxChain, describe the full signal chain including:',
    '  1. Specific device settings (threshold, ratio, attack, release)',
    '  2. Sidechain compression setup if applicable (source track, amount)',
    '  3. Return channel vs insert distinction',
    '',
    'For secretSauce, provide the single most distinctive production technique',
    'heard in this track, with step-by-step Ableton Live 12 implementation',
    'using only native devices.',
    '',
    'Elements to enhance (use exact names):',
    JSON.stringify({
      instrumentation: blueprint.instrumentation.map((i) => ({ element: i.element })),
      fxChain: blueprint.fxChain.map((f) => ({ artifact: f.artifact })),
    }),
    '',
    'Return ONLY strict JSON — no markdown fences, no explanation:',
    '{',
    '  "groove": "describe feel, micro-timing, and swing character based on analysis",',
    '  "instrumentation": [{"element":"exact existing element name","timbre":"synthesis type + MIDI range + texture","abletonDevice":"device chain + parameter settings"}],',
    '  "fxChain": [{"artifact":"exact existing artifact name","recommendation":"FX chain + device settings + sidechain routing"}],',
    '  "secretSauce": {"trick":"unique production technique","execution":"step-by-step Ableton Live 12 recreation with native devices"}',
    '}',
  );

  return lines.join('\n');
}
