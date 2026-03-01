import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { decodeAudioFile } from './audioAnalysis';
import { LocalAnalysisProvider } from './localProvider';
import {
  DEFAULT_OLLAMA_CONFIG,
  getStoredOllamaConfig,
  isOllamaAvailable,
  isModelPulled,
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
    `BPM: ${blueprint.telemetry.bpm} | Key: ${blueprint.telemetry.key}`,
    '',
    'For each instrument, include in "abletonDevice": device chain + key parameter settings.',
    'For each instrument, include in "timbre": synthesis type + approximate MIDI note range (e.g. C2-C5).',
    'For fxChain, include sidechain compression setup if audible.',
    'For secretSauce, give step-by-step Ableton Live 12 native device implementation.',
    '',
    'Return strict JSON with this shape only:',
    '{',
    '  "groove": "optional string",',
    '  "instrumentation": [{"element":"exact existing element","timbre":"synth type + MIDI range","abletonDevice":"device chain + settings"}],',
    '  "fxChain": [{"artifact":"exact existing artifact","recommendation":"FX chain + sidechain routing"}],',
    '  "secretSauce": {"trick":"technique name","execution":"Ableton steps"}',
    '}',
    '',
    'Blueprint:',
    JSON.stringify({
      telemetry: blueprint.telemetry,
      instrumentation: blueprint.instrumentation.map((i) => ({ element: i.element })),
      fxChain: blueprint.fxChain.map((f) => ({ artifact: f.artifact })),
    }),
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
  private config: OllamaConfig;

  constructor(
    private readonly localProvider: LocalAnalysisProvider = new LocalAnalysisProvider(),
    config?: OllamaConfig
  ) {
    // Merge stored config with defaults
    const stored = getStoredOllamaConfig();
    this.config = {
      ...DEFAULT_OLLAMA_CONFIG,
      ...stored,
      ...config,
    };
    // Normalize model name (trim whitespace)
    this.config.model = this.config.model.trim();
    // Ensure baseUrl has protocol
    if (this.config.baseUrl && !this.config.baseUrl.startsWith('http')) {
      this.config.baseUrl = `http://${this.config.baseUrl}`;
    }
    console.log('[OllamaProvider] Config:', this.config);
  }

  async isAvailable(): Promise<boolean> {
    console.log('[OllamaProvider] Checking availability at:', this.config.baseUrl);
    return isOllamaAvailable(this.config.baseUrl);
  }

  async checkModelPulled(): Promise<boolean> {
    console.log('[OllamaProvider] Checking if model is pulled:', this.config.model);
    return isModelPulled(this.config.model, this.config.baseUrl);
  }

  getConfig(): OllamaConfig {
    return { ...this.config };
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
      console.log('[OllamaProvider] Querying Ollama...');
      const raw = await queryOllama(prompt, this.config);
      const enhancement = parseEnhancement(raw);
      const hasEnhancement = enhancement && (
        enhancement.groove || 
        (enhancement.instrumentation?.length) || 
        (enhancement.fxChain?.length) ||
        enhancement.secretSauce?.trick
      );
      console.log('[OllamaProvider] Enhancement applied:', hasEnhancement);
      const merged = mergeEnhancement(localBlueprint, enhancement);

      return {
        ...merged,
        meta: merged.meta
          ? {
              ...merged.meta,
              provider: 'ollama',
              llmEnhanced: !!hasEnhancement,
              analysisTime: Math.round(performance.now() - startTime),
            }
          : undefined,
      };
    } catch (err) {
      console.warn('[OllamaProvider] Query failed, using local analysis only:', err);
      return {
        ...localBlueprint,
        meta: localBlueprint.meta
          ? {
              ...localBlueprint.meta,
              provider: 'ollama',
              llmEnhanced: false,
              analysisTime: Math.round(performance.now() - startTime),
            }
          : undefined,
      };
    }
  }
}
