import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { decodeAudioFile } from './audioAnalysis';
import { LocalAnalysisProvider } from './localProvider';
import {
  DEFAULT_OLLAMA_CONFIG,
  isOllamaAvailable,
  OllamaConfig,
  queryOllama,
} from './ollamaClient';

interface OllamaEnhancement {
  groove?: string;
  instrumentation?: Array<{
    element: string;
    timbre?: string;
    abletonDevice?: string;
  }>;
  fxChain?: Array<{
    artifact: string;
    recommendation?: string;
  }>;
  secretSauce?: {
    trick?: string;
    execution?: string;
  };
}

function buildPrompt(blueprint: ReconstructionBlueprint): string {
  return [
    'You are an Ableton Live 12 production assistant.',
    'Enhance descriptive text only. Do not change measured values.',
    '',
    'Return strict JSON with this shape only:',
    '{',
    '  "groove": "optional string",',
    '  "instrumentation": [{"element":"exact existing element","timbre":"optional","abletonDevice":"optional"}],',
    '  "fxChain": [{"artifact":"exact existing artifact","recommendation":"optional"}],',
    '  "secretSauce": {"trick":"optional","execution":"optional"}',
    '}',
    '',
    'Blueprint:',
    JSON.stringify(blueprint),
  ].join('\n');
}

function parseEnhancement(raw: string): OllamaEnhancement | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as OllamaEnhancement;
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

function mergeEnhancement(
  blueprint: ReconstructionBlueprint,
  enhancement: OllamaEnhancement | null
): ReconstructionBlueprint {
  if (!enhancement) return blueprint;

  const merged: ReconstructionBlueprint = {
    ...blueprint,
    telemetry: { ...blueprint.telemetry },
    instrumentation: blueprint.instrumentation.map((item) => ({ ...item })),
    fxChain: blueprint.fxChain.map((item) => ({ ...item })),
    secretSauce: { ...blueprint.secretSauce },
    meta: blueprint.meta ? { ...blueprint.meta } : undefined,
  };

  if (enhancement.groove && typeof enhancement.groove === 'string') {
    merged.telemetry.groove = enhancement.groove;
  }

  if (Array.isArray(enhancement.instrumentation)) {
    for (const update of enhancement.instrumentation) {
      if (!update?.element) continue;
      const index = merged.instrumentation.findIndex((item) => item.element === update.element);
      if (index === -1) continue;
      if (typeof update.timbre === 'string' && update.timbre.trim()) {
        merged.instrumentation[index].timbre = update.timbre.trim();
      }
      if (typeof update.abletonDevice === 'string' && update.abletonDevice.trim()) {
        merged.instrumentation[index].abletonDevice = update.abletonDevice.trim();
      }
    }
  }

  if (Array.isArray(enhancement.fxChain)) {
    for (const update of enhancement.fxChain) {
      if (!update?.artifact) continue;
      const index = merged.fxChain.findIndex((item) => item.artifact === update.artifact);
      if (index === -1) continue;
      if (typeof update.recommendation === 'string' && update.recommendation.trim()) {
        merged.fxChain[index].recommendation = update.recommendation.trim();
      }
    }
  }

  if (enhancement.secretSauce) {
    if (typeof enhancement.secretSauce.trick === 'string' && enhancement.secretSauce.trick.trim()) {
      merged.secretSauce.trick = enhancement.secretSauce.trick.trim();
    }
    if (
      typeof enhancement.secretSauce.execution === 'string' &&
      enhancement.secretSauce.execution.trim()
    ) {
      merged.secretSauce.execution = enhancement.secretSauce.execution.trim();
    }
  }

  return merged;
}

export class OllamaProvider implements AnalysisProvider {
  name = 'Local LLM (Ollama)';
  type = 'ollama' as const;

  constructor(
    private readonly localProvider: LocalAnalysisProvider = new LocalAnalysisProvider(),
    private readonly config: OllamaConfig = DEFAULT_OLLAMA_CONFIG
  ) {}

  async isAvailable(): Promise<boolean> {
    return isOllamaAvailable(this.config.baseUrl);
  }

  async analyze(file: File): Promise<ReconstructionBlueprint> {
    const audioBuffer = await decodeAudioFile(file);
    return this.analyzeAudioBuffer(audioBuffer);
  }

  async analyzeAudioBuffer(audioBuffer: AudioBuffer): Promise<ReconstructionBlueprint> {
    const startTime = performance.now();
    const localBlueprint = await this.localProvider.analyzeAudioBuffer(audioBuffer);
    const prompt = buildPrompt(localBlueprint);

    try {
      const raw = await queryOllama(prompt, this.config);
      const enhancement = parseEnhancement(raw);
      const merged = mergeEnhancement(localBlueprint, enhancement);

      return {
        ...merged,
        meta: merged.meta
          ? {
              ...merged.meta,
              provider: 'ollama',
              analysisTime: Math.round(performance.now() - startTime),
            }
          : undefined,
      };
    } catch {
      return {
        ...localBlueprint,
        meta: localBlueprint.meta
          ? {
              ...localBlueprint.meta,
              provider: 'ollama',
              analysisTime: Math.round(performance.now() - startTime),
            }
          : undefined,
      };
    }
  }
}
