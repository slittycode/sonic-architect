/**
 * Ollama-Enhanced Analysis Provider
 *
 * Combines client-side DSP (identical to LocalAnalysisProvider) with an
 * optional Ollama LLM pass that enriches text descriptions.
 *
 * Flow:
 *   1. Decode audio  →  extract features  (same as local)
 *   2. Build baseline blueprint            (same as local)
 *   3. Send feature summary to Ollama      (LLM enhancement)
 *   4. Merge LLM output into blueprint     (local wins for numbers)
 *
 * If Ollama is unreachable or the LLM returns garbage, the provider
 * silently falls back to the local-only blueprint.
 */

import {
  AnalysisProvider,
  ReconstructionBlueprint,
  AudioFeatures,
  ArrangementSection,
  InstrumentRackElement,
  FXChainItem,
  SecretSauce,
} from '../types';
import { decodeAudioFile, extractAudioFeatures } from './audioAnalysis';
import {
  getInstrumentRecommendations,
  getFXRecommendations,
  getSecretSauce,
} from '../data/abletonDevices';
import { queryOllama, isOllamaAvailable, OllamaConfig, DEFAULT_OLLAMA_CONFIG } from './ollamaClient';

// ── Local DSP helpers (shared with localProvider) ──────────────────────

function detectArrangement(
  rmsProfile: number[],
  duration: number
): ArrangementSection[] {
  if (rmsProfile.length === 0) {
    return [{ timeRange: `0:00–${fmtTime(duration)}`, label: 'Full Track', description: 'Unable to segment — audio too short.' }];
  }

  const windowSize = Math.max(3, Math.floor(rmsProfile.length / 50));
  const smoothed: number[] = [];
  for (let i = 0; i < rmsProfile.length; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - windowSize); j <= Math.min(rmsProfile.length - 1, i + windowSize); j++) {
      sum += rmsProfile[j]; count++;
    }
    smoothed.push(sum / count);
  }

  const maxRms = Math.max(...smoothed);
  const normalized = maxRms > 0 ? smoothed.map(v => v / maxRms) : smoothed;

  const changePoints: number[] = [0];
  const changeThreshold = 0.15;

  for (let i = 1; i < normalized.length - 1; i++) {
    const lookback = Math.min(10, i);
    const lookahead = Math.min(10, normalized.length - i - 1);
    let prevAvg = 0;
    for (let j = i - lookback; j < i; j++) prevAvg += normalized[j];
    prevAvg /= lookback;
    let nextAvg = 0;
    for (let j = i; j < i + lookahead; j++) nextAvg += normalized[j];
    nextAvg /= lookahead;
    if (Math.abs(nextAvg - prevAvg) > changeThreshold) {
      if (i - changePoints[changePoints.length - 1] > rmsProfile.length / 20) {
        changePoints.push(i);
      }
    }
  }

  while (changePoints.length > 8) {
    let minDelta = Infinity, minIdx = 1;
    for (let i = 1; i < changePoints.length; i++) {
      const delta = Math.abs(normalized[changePoints[i]] - normalized[changePoints[i - 1]]);
      if (delta < minDelta) { minDelta = delta; minIdx = i; }
    }
    changePoints.splice(minIdx, 1);
  }

  if (changePoints.length < 2 && duration > 10) {
    changePoints.push(Math.floor(rmsProfile.length * 0.15));
    changePoints.push(Math.floor(rmsProfile.length * 0.85));
    changePoints.sort((a, b) => a - b);
  }

  const sectionLabels = ['Intro', 'Build', 'Main', 'Chorus', 'Breakdown', 'Drop', 'Bridge', 'Outro'];
  const sections: ArrangementSection[] = [];

  for (let i = 0; i < changePoints.length; i++) {
    const startFrame = changePoints[i];
    const endFrame = i < changePoints.length - 1 ? changePoints[i + 1] : rmsProfile.length;
    const startTime = (startFrame / rmsProfile.length) * duration;
    const endTime = (endFrame / rmsProfile.length) * duration;

    let sectionEnergy = 0;
    for (let j = startFrame; j < endFrame; j++) sectionEnergy += normalized[j];
    sectionEnergy /= Math.max(1, endFrame - startFrame);

    const position = startFrame / rmsProfile.length;
    let label: string;
    if (position < 0.1) label = 'Intro';
    else if (position > 0.85) label = 'Outro';
    else if (sectionEnergy > 0.75) label = (i > 0 && sections[i - 1]?.label === 'Build') ? 'Drop' : 'Chorus';
    else if (sectionEnergy > 0.5) label = 'Main';
    else if (sectionEnergy > 0.3) label = 'Build';
    else label = 'Breakdown';

    const energyDesc = sectionEnergy > 0.75
      ? 'High energy — full arrangement, all elements active.'
      : sectionEnergy > 0.5
        ? 'Medium-high energy — core elements present, building momentum.'
        : sectionEnergy > 0.3
          ? 'Medium energy — reduced arrangement, focus on key elements.'
          : 'Low energy — sparse arrangement, atmospheric or transitional.';

    sections.push({ timeRange: `${fmtTime(startTime)}–${fmtTime(endTime)}`, label, description: energyDesc });
  }

  for (let i = 1; i < sections.length; i++) {
    if (sections[i].label === sections[i - 1].label) {
      const idx = sectionLabels.indexOf(sections[i].label) + 1;
      sections[i].label = sectionLabels[idx % sectionLabels.length];
    }
  }
  return sections;
}

function fmtTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function describeGroove(f: { onsetDensity: number; bpm: number; crestFactor: number }): string {
  let g = f.bpm < 90 ? 'Slow and spacious groove'
    : f.bpm < 120 ? 'Mid-tempo groove'
      : f.bpm < 140 ? 'Driving, forward-moving groove'
        : 'High-energy, uptempo groove';

  g += f.onsetDensity > 8 ? ' with dense rhythmic activity'
    : f.onsetDensity > 4 ? ' with moderate rhythmic complexity'
      : ' with sparse, minimal hits';

  g += f.crestFactor < 6 ? '. Heavily compressed dynamics — punchy and in-your-face.'
    : f.crestFactor < 12 ? '. Balanced dynamics with punch.'
      : '. Wide dynamic range — natural, uncompressed feel.';

  return g;
}

// ── LLM enhancement prompt ─────────────────────────────────────────────

function buildEnhancementPrompt(features: AudioFeatures): string {
  const bands = features.spectralBands
    .map(b => `${b.name}: ${b.averageDb.toFixed(1)}dB avg, ${b.dominance}`)
    .join('; ');

  return `You are Sonic Architect, an expert Ableton Live 12 sound designer and producer.

Given the following DSP analysis of an audio file, provide enhanced descriptions for an Ableton Live reconstruction blueprint. Return ONLY valid JSON — no markdown, no explanation.

## Audio Features
- BPM: ${features.bpm} (confidence: ${(features.bpmConfidence * 100).toFixed(0)}%)
- Key: ${features.key.root} ${features.key.scale} (confidence: ${(features.key.confidence * 100).toFixed(0)}%)
- Spectral Centroid: ${features.spectralCentroidMean.toFixed(0)} Hz
- RMS Mean: ${features.rmsMean.toFixed(4)}
- Crest Factor: ${features.crestFactor.toFixed(1)} dB
- Onset Density: ${features.onsetDensity.toFixed(1)} per second
- Duration: ${features.duration.toFixed(1)}s
- Sample Rate: ${features.sampleRate} Hz
- Spectral Bands: ${bands}

## Required JSON Structure
{
  "groove": "A vivid, musical description of the groove and feel (1-2 sentences)",
  "arrangement": [
    { "label": "Section name", "description": "What's happening musically in this section (1 sentence)" }
  ],
  "instrumentation": [
    { "element": "Name", "timbre": "Detailed timbre description", "abletonDevice": "Specific Ableton Live 12 device and preset suggestion" }
  ],
  "fxChain": [
    { "artifact": "What sonic characteristic this addresses", "recommendation": "Specific Ableton device chain with settings" }
  ],
  "secretSauce": {
    "trick": "The standout production technique",
    "execution": "Step-by-step Ableton Live 12 implementation"
  }
}

Important:
- For instrumentation, suggest 3-6 elements that match the spectral profile
- For fxChain, suggest 2-4 processing chains
- All device suggestions must be real Ableton Live 12 stock devices
- Be specific with device parameters (ratios, frequencies, ms values)`;
}

// ── Merge LLM response into local blueprint ────────────────────────────

interface LLMEnhancement {
  groove?: string;
  arrangement?: Array<{ label?: string; description?: string }>;
  instrumentation?: Array<{ element?: string; timbre?: string; abletonDevice?: string }>;
  fxChain?: Array<{ artifact?: string; recommendation?: string }>;
  secretSauce?: { trick?: string; execution?: string };
}

function mergeEnhancement(
  base: ReconstructionBlueprint,
  llm: LLMEnhancement
): ReconstructionBlueprint {
  const out = { ...base };

  // Groove — replace if LLM provided a richer one
  if (llm.groove && llm.groove.length > 20) {
    out.telemetry = { ...out.telemetry, groove: llm.groove };
  }

  // Arrangement — keep local time ranges, enrich descriptions
  if (Array.isArray(llm.arrangement) && llm.arrangement.length > 0) {
    out.arrangement = base.arrangement.map((section, i) => {
      const llmSection = llm.arrangement?.[i];
      if (!llmSection) return section;
      return {
        ...section,
        label: llmSection.label || section.label,
        description: llmSection.description || section.description,
      };
    });
  }

  // Instrumentation — prefer LLM list if it has real entries
  if (Array.isArray(llm.instrumentation) && llm.instrumentation.length >= 2) {
    const valid = llm.instrumentation.filter(
      i => i.element && i.timbre && i.abletonDevice
    ) as InstrumentRackElement[];
    if (valid.length >= 2) {
      // Merge: enrich frequency from local if missing
      out.instrumentation = valid.map((v, idx) => ({
        element: v.element,
        timbre: v.timbre,
        frequency: base.instrumentation[idx]?.frequency ?? '',
        abletonDevice: v.abletonDevice,
      }));
    }
  }

  // FX Chain — prefer LLM if substantive
  if (Array.isArray(llm.fxChain) && llm.fxChain.length >= 2) {
    const valid = llm.fxChain.filter(
      f => f.artifact && f.recommendation
    ) as FXChainItem[];
    if (valid.length >= 2) out.fxChain = valid;
  }

  // Secret Sauce — prefer LLM if detailed
  if (llm.secretSauce?.trick && llm.secretSauce?.execution) {
    if (llm.secretSauce.execution.length > 30) {
      out.secretSauce = llm.secretSauce as SecretSauce;
    }
  }

  return out;
}

// ── Provider class ─────────────────────────────────────────────────────

export class OllamaProvider implements AnalysisProvider {
  name = 'Local LLM (Ollama)';
  type = 'ollama' as const;

  private config: OllamaConfig;

  constructor(config?: Partial<OllamaConfig>) {
    this.config = { ...DEFAULT_OLLAMA_CONFIG, ...config };
  }

  async isAvailable(): Promise<boolean> {
    return isOllamaAvailable(this.config.baseUrl);
  }

  async analyze(file: File): Promise<ReconstructionBlueprint> {
    const startTime = performance.now();

    // Phase 1: Local DSP (identical to LocalAnalysisProvider)
    const audioBuffer = await decodeAudioFile(file);
    const features = extractAudioFeatures(audioBuffer);

    const arrangement = detectArrangement(features.rmsProfile, features.duration);
    const instrumentation = getInstrumentRecommendations(features.spectralBands);
    const fxChain = getFXRecommendations(features);
    const secretSauce = getSecretSauce(features);

    const localBlueprint: ReconstructionBlueprint = {
      telemetry: {
        bpm: `${features.bpm}`,
        key: `${features.key.root} ${features.key.scale}`,
        groove: describeGroove(features),
        bpmConfidence: features.bpmConfidence,
        keyConfidence: features.key.confidence,
      },
      arrangement,
      instrumentation,
      fxChain: fxChain.length > 0 ? fxChain : [{
        artifact: 'Balanced dynamics and spectrum',
        recommendation: 'No major issues detected. Consider light mastering chain: EQ Eight (gentle cuts), Glue Compressor (2:1, gentle), Limiter (-0.3dB ceiling).',
      }],
      secretSauce,
      meta: {
        provider: 'ollama',
        analysisTime: 0, // updated below
        sampleRate: features.sampleRate,
        duration: features.duration,
        channels: features.channels,
      },
    };

    // Phase 2: LLM Enhancement (best-effort)
    try {
      const prompt = buildEnhancementPrompt(features);
      const raw = await queryOllama(prompt, this.config);

      // Parse JSON from response (strip possible markdown fences)
      const jsonStr = raw.replace(/^```json?\s*/, '').replace(/```\s*$/, '').trim();
      const llmData: LLMEnhancement = JSON.parse(jsonStr);

      const enhanced = mergeEnhancement(localBlueprint, llmData);
      enhanced.meta = {
        ...enhanced.meta!,
        analysisTime: Math.round(performance.now() - startTime),
      };
      return enhanced;
    } catch (err) {
      console.warn('Ollama enhancement failed, using local-only blueprint:', err);
      localBlueprint.meta!.analysisTime = Math.round(performance.now() - startTime);
      return localBlueprint;
    }
  }
}
