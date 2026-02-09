/**
 * AWS Bedrock Analysis Provider
 *
 * Local DSP analysis enhanced with AWS Bedrock LLM (Claude, Llama, Mistral).
 * Requires AWS credentials with bedrock:InvokeModel permission.
 * No AWS SDK dependency — uses lightweight SigV4 signing.
 */

import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { analyzeWithLLM } from './llmProviderBase';
import { queryBedrock, isBedrockAvailable, BedrockConfig, DEFAULT_BEDROCK_CONFIG } from './bedrockClient';

export class BedrockProvider implements AnalysisProvider {
  name = 'AWS Bedrock';
  type = 'bedrock' as const;

  private config: BedrockConfig;

  constructor(config?: Partial<BedrockConfig>) {
    this.config = { ...DEFAULT_BEDROCK_CONFIG, ...config };
  }

  async isAvailable(): Promise<boolean> {
    return isBedrockAvailable(this.config);
  }

  async analyze(file: File): Promise<ReconstructionBlueprint> {
    return analyzeWithLLM(
      file,
      (prompt) => queryBedrock(prompt, this.config),
      'bedrock',
    );
  }
}
