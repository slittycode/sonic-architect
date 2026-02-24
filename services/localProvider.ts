/**
 * Local Analysis Provider
 *
 * Performs audio analysis entirely client-side using Web Audio API,
 * custom DSP (BPM, key detection), and the Ableton device knowledge base.
 * No API keys, no network requests, works offline.
 */

import {
  AnalysisProvider,
  AudioFeatures,
  ReconstructionBlueprint,
  ArrangementSection,
} from '../types';
import { decodeAudioFile, extractAudioFeatures } from './audioAnalysis';
import {
  getInstrumentRecommendations,
  getFXRecommendations,
  getSecretSauce,
} from '../data/abletonDevices';
import { generateVitalPatch, generateOperatorPatch } from './patchSmith';
import { generateMixReport } from './mixDoctor';

/**
 * Segment the RMS energy profile into arrangement sections.
 * Uses energy change-points to identify structural sections.
 */
function detectArrangement(rmsProfile: number[], duration: number): ArrangementSection[] {
  if (rmsProfile.length === 0) {
    return [
      {
        timeRange: `0:00–${formatTime(duration)}`,
        label: 'Full Track',
        description: 'Unable to segment — audio too short.',
      },
    ];
  }

  // Smooth the RMS profile to reduce noise
  const windowSize = Math.max(3, Math.floor(rmsProfile.length / 50));
  const smoothed: number[] = [];
  for (let i = 0; i < rmsProfile.length; i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - windowSize);
      j <= Math.min(rmsProfile.length - 1, i + windowSize);
      j++
    ) {
      sum += rmsProfile[j];
      count++;
    }
    smoothed.push(sum / count);
  }

  // Normalize to 0-1
  const maxRms = Math.max(...smoothed);
  const normalized = maxRms > 0 ? smoothed.map((v) => v / maxRms) : smoothed;

  // Find significant energy changes (change-point detection)
  const changePoints: number[] = [0]; // Always start at 0
  const changeThreshold = 0.15; // 15% energy change

  for (let i = 1; i < normalized.length - 1; i++) {
    // Look at a window around this point
    const lookback = Math.min(10, i);
    const lookahead = Math.min(10, normalized.length - i - 1);

    let prevAvg = 0;
    for (let j = i - lookback; j < i; j++) prevAvg += normalized[j];
    prevAvg /= lookback;

    let nextAvg = 0;
    for (let j = i; j < i + lookahead; j++) nextAvg += normalized[j];
    nextAvg /= lookahead;

    const delta = Math.abs(nextAvg - prevAvg);
    if (delta > changeThreshold) {
      // Ensure minimum distance between change points
      const lastCp = changePoints[changePoints.length - 1];
      if (i - lastCp > rmsProfile.length / 20) {
        changePoints.push(i);
      }
    }
  }

  // Limit sections to a reasonable number (3-8)
  while (changePoints.length > 8) {
    // Remove the change point with smallest energy delta
    let minDelta = Infinity;
    let minIdx = 1;
    for (let i = 1; i < changePoints.length; i++) {
      const cp = changePoints[i];
      const prev = changePoints[i - 1];
      const delta = Math.abs(normalized[cp] - normalized[prev]);
      if (delta < minDelta) {
        minDelta = delta;
        minIdx = i;
      }
    }
    changePoints.splice(minIdx, 1);
  }

  // Ensure at least 2 sections for non-trivial audio
  if (changePoints.length < 2 && duration > 10) {
    // Split into intro, main, outro
    changePoints.push(Math.floor(rmsProfile.length * 0.15));
    changePoints.push(Math.floor(rmsProfile.length * 0.85));
    changePoints.sort((a, b) => a - b);
  }

  // Label each section based on energy level
  const sections: ArrangementSection[] = [];
  const sectionLabels = [
    'Intro',
    'Build',
    'Main',
    'Chorus',
    'Breakdown',
    'Drop',
    'Bridge',
    'Outro',
  ];

  for (let i = 0; i < changePoints.length; i++) {
    const startFrame = changePoints[i];
    const endFrame = i < changePoints.length - 1 ? changePoints[i + 1] : rmsProfile.length;

    const startTime = (startFrame / rmsProfile.length) * duration;
    const endTime = (endFrame / rmsProfile.length) * duration;

    // Average energy in this section
    let sectionEnergy = 0;
    for (let j = startFrame; j < endFrame; j++) {
      sectionEnergy += normalized[j];
    }
    sectionEnergy /= Math.max(1, endFrame - startFrame);

    // Determine label based on position and energy
    let label: string;
    const position = startFrame / rmsProfile.length;
    if (position < 0.1) {
      label = 'Intro';
    } else if (position > 0.85) {
      label = 'Outro';
    } else if (sectionEnergy > 0.75) {
      label = i > 0 && sections[i - 1]?.label === 'Build' ? 'Drop' : 'Chorus';
    } else if (sectionEnergy > 0.5) {
      label = 'Main';
    } else if (sectionEnergy > 0.3) {
      label = 'Build';
    } else {
      label = 'Breakdown';
    }

    // Energy description
    const energyDesc =
      sectionEnergy > 0.75
        ? 'High energy — full arrangement, all elements active.'
        : sectionEnergy > 0.5
          ? 'Medium-high energy — core elements present, building momentum.'
          : sectionEnergy > 0.3
            ? 'Medium energy — reduced arrangement, focus on key elements.'
            : 'Low energy — sparse arrangement, atmospheric or transitional.';

    sections.push({
      timeRange: `${formatTime(startTime)}–${formatTime(endTime)}`,
      label,
      description: energyDesc,
    });
  }

  // Deduplicate labels if needed (don't have two consecutive "Main" sections)
  for (let i = 1; i < sections.length; i++) {
    if (sections[i].label === sections[i - 1].label) {
      const fallbackIdx = sectionLabels.indexOf(sections[i].label) + 1;
      sections[i].label = sectionLabels[fallbackIdx % sectionLabels.length];
    }
  }

  return sections;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Describe groove from onset density and BPM
 */
function describeGroove(features: {
  onsetDensity: number;
  bpm: number;
  crestFactor: number;
}): string {
  const { onsetDensity, bpm, crestFactor } = features;

  let groove = '';

  if (bpm < 90) groove = 'Slow and spacious groove';
  else if (bpm < 120) groove = 'Mid-tempo groove';
  else if (bpm < 140) groove = 'Driving, forward-moving groove';
  else groove = 'High-energy, uptempo groove';

  if (onsetDensity > 8) groove += ' with dense rhythmic activity';
  else if (onsetDensity > 4) groove += ' with moderate rhythmic complexity';
  else groove += ' with sparse, minimal hits';

  if (crestFactor < 6) groove += '. Heavily compressed dynamics — punchy and in-your-face.';
  else if (crestFactor < 12) groove += '. Balanced dynamics with punch.';
  else groove += '. Wide dynamic range — natural, uncompressed feel.';

  return groove;
}

export function buildLocalBlueprint(
  features: AudioFeatures,
  analysisTime: number,
  provider: 'local' | 'ollama' = 'local'
): ReconstructionBlueprint {
  const arrangement = detectArrangement(features.rmsProfile, features.duration);
  const instrumentation = getInstrumentRecommendations(features.spectralBands);
  const fxChain = getFXRecommendations(features);
  const secretSauce = getSecretSauce(features);
  const patches = {
    vital: generateVitalPatch(features),
    operator: generateOperatorPatch(features),
  };
  const mixReport = generateMixReport(features); // Use default EDM profile

  return {
    telemetry: {
      bpm: `${features.bpm}`,
      key: `${features.key.root} ${features.key.scale}`,
      groove: describeGroove(features),
      bpmConfidence: features.bpmConfidence,
      keyConfidence: features.key.confidence,
    },
    arrangement,
    instrumentation,
    fxChain:
      fxChain.length > 0
        ? fxChain
        : [
            {
              artifact: 'Balanced dynamics and spectrum',
              recommendation:
                'No major issues detected. Consider light mastering chain: EQ Eight (gentle cuts), Glue Compressor (2:1, gentle), Limiter (-0.3dB ceiling).',
            },
          ],
    secretSauce,
    patches,
    mixReport,
    meta: {
      provider,
      analysisTime,
      sampleRate: features.sampleRate,
      duration: features.duration,
      channels: features.channels,
    },
  };
}

export class LocalAnalysisProvider implements AnalysisProvider {
  name = 'Local DSP Engine';
  type = 'local' as const;

  async isAvailable(): Promise<boolean> {
    // Always available — client-side only
    return true;
  }

  async analyze(file: File, signal?: AbortSignal): Promise<ReconstructionBlueprint> {
    const audioBuffer = await decodeAudioFile(file);
    signal?.throwIfAborted();
    return this.analyzeAudioBuffer(audioBuffer, signal);
  }

  async analyzeAudioBuffer(
    audioBuffer: AudioBuffer,
    signal?: AbortSignal
  ): Promise<ReconstructionBlueprint> {
    const startTime = performance.now();

    // Extract features
    const features = extractAudioFeatures(audioBuffer);
    signal?.throwIfAborted();

    const analysisTime = Math.round(performance.now() - startTime);
    return buildLocalBlueprint(features, analysisTime, 'local');
  }
}
