/**
 * OpenAI Analysis Provider
 *
 * Local DSP analysis enhanced with OpenAI Chat Completions (GPT-4o, etc.).
 * Requires an OpenAI API key (Pro/Plus subscription or API credits).
 */

import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { analyzeWithLLM } from './llmProviderBase';
import { queryOpenAI, isOpenAIAvailable, OpenAIConfig, DEFAULT_OPENAI_CONFIG } from './openaiClient';

export class OpenAIProvider implements AnalysisProvider {
  name = 'OpenAI (ChatGPT)';
  type = 'openai' as const;

  private config: OpenAIConfig;

  constructor(config?: Partial<OpenAIConfig>) {
    this.config = { ...DEFAULT_OPENAI_CONFIG, ...config };
  }

  async isAvailable(): Promise<boolean> {
    return isOpenAIAvailable(this.config);
  }

  async analyze(file: File): Promise<ReconstructionBlueprint> {
    return analyzeWithLLM(
      file,
      (prompt) => queryOpenAI(prompt, this.config),
      'openai',
    );
  }
}
