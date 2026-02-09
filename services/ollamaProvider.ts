/**
 * Ollama-Enhanced Analysis Provider
 *
 * Local DSP + Ollama LLM enhancement. Uses the shared llmProviderBase pipeline.
 */

import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { analyzeWithLLM } from './llmProviderBase';
import { queryOllama, isOllamaAvailable, OllamaConfig, DEFAULT_OLLAMA_CONFIG } from './ollamaClient';

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
    return analyzeWithLLM(
      file,
      (prompt) => queryOllama(prompt, this.config),
      'ollama',
    );
  }
}
