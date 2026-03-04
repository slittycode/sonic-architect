import type { Part } from '@google/genai';
import type { AnalysisProvider, ReconstructionBlueprint } from '../../../types';
import { decodeAudioFile, extractAudioFeatures } from '../../audioAnalysis';
import { LocalAnalysisProvider } from '../../localProvider';
import { buildPhase1Prompt } from '../../gemini/prompts/phase1Analysis';
import { buildPhase2Prompt } from '../../gemini/prompts/phase2Refinement';
import type { GeminiPhase1Response } from '../../gemini/schemas/phase1Schema';
import type { GeminiPhase2Additions } from '../../gemini/schemas/phase2Schema';
import {
  addDiagnosticEntry,
  finishAndDownloadReport,
  isDiagEnabled,
  startDiagnosticReport,
} from '../../gemini/diagnosticLog';
import { extractJsonFromText } from '../../gemini/extractJson';
import { assembleBlueprint } from './assembler';
import {
  DEFAULT_MODEL,
  GEMINI_MODEL_LABELS,
  MODELS_WITHOUT_JSON_MODE,
  createGeminiClient,
  modelPath,
  type GeminiModelId,
} from './client';
import {
  buildAudioPartFromUri,
  buildInlineAudioPart,
  readFileAsBase64,
  uploadToFilesAPI,
} from './files';
import { runBaseDSP, withRetry } from './phases';
import { parsePhase1Response, parsePhase2Response } from './validation';

export class GeminiProvider implements AnalysisProvider {
  type = 'gemini' as const;
  private modelId: GeminiModelId;

  constructor(model: GeminiModelId = DEFAULT_MODEL) {
    this.modelId = model;
  }

  get name(): string {
    return `${GEMINI_MODEL_LABELS[this.modelId]} (Cloud + Local DSP)`;
  }

  async isAvailable(): Promise<boolean> {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    return typeof key === 'string' && key.length > 0;
  }

  async analyze(
    file: File,
    signal?: AbortSignal,
    onProgress?: (message: string) => void
  ): Promise<ReconstructionBlueprint> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing API key. Set GEMINI_API_KEY in .env.local to use the Gemini provider.'
      );
    }

    signal?.throwIfAborted();

    const startTime = performance.now();
    const ai = createGeminiClient(apiKey);
    const modelId = this.modelId;
    const model = modelPath(modelId);

    startDiagnosticReport(modelId, model, file.name, file.size);

    onProgress?.('Uploading audio...');
    const audioBuffer = await decodeAudioFile(file);
    signal?.throwIfAborted();
    onProgress?.('Decoding audio...');

    let fileUri: string | null = null;
    let fileName: string | null = null;
    let base64Fallback: string | null = null;

    const [uploadResult, hints] = await Promise.all([
      uploadToFilesAPI(ai, file).catch(async (err) => {
        console.warn('[GeminiProvider] Files API upload failed, using inline base64:', err);
        base64Fallback = await readFileAsBase64(file);
        return null;
      }),
      runBaseDSP(audioBuffer),
    ]);

    signal?.throwIfAborted();
    if (uploadResult) {
      fileUri = uploadResult.fileUri;
      fileName = uploadResult.fileName;
    }

    const features = extractAudioFeatures(audioBuffer);
    const audioPart: Part = fileUri
      ? buildAudioPartFromUri(fileUri, file.type)
      : buildInlineAudioPart(base64Fallback!, file.type);

    signal?.throwIfAborted();
    onProgress?.('Analyzing with Gemini (Phase 1)...');

    const useJsonMode = !MODELS_WITHOUT_JSON_MODE.has(modelId);
    let phase1: GeminiPhase1Response;

    try {
      phase1 = await withRetry(async () => {
        signal?.throwIfAborted();
        const basePrompt = buildPhase1Prompt(hints);
        const phase1Prompt = useJsonMode
          ? basePrompt
          : basePrompt +
            '\n\nRespond with ONLY a single JSON object. Do not include any markdown formatting, commentary, or text outside the JSON.';
        const phase1Start = performance.now();

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              parts: [audioPart, { text: phase1Prompt }],
            },
          ],
          config: useJsonMode
            ? { responseMimeType: 'application/json', temperature: 0 }
            : { temperature: 0 },
        });

        let rawText = response.text ?? '{}';
        if (!useJsonMode) {
          rawText = extractJsonFromText(rawText);
        }

        if (isDiagEnabled()) {
          addDiagnosticEntry({
            phase: 'phase1',
            model: modelId,
            modelPath: model,
            audioPartType: fileUri ? 'fileData' : 'inlineData',
            audioMimeType: file.type,
            fileUri: fileUri ?? undefined,
            promptLength: phase1Prompt.length,
            promptPreview: phase1Prompt.slice(0, 500),
            configSent: useJsonMode
              ? { responseMimeType: 'application/json' }
              : { responseMimeType: 'none (free-text)' },
            responseLength: rawText.length,
            responseFirst500: rawText.slice(0, 500),
            responseLast200: rawText.slice(-200),
            responseFullText: rawText,
            durationMs: Math.round(performance.now() - phase1Start),
          });
        }

        return parsePhase1Response(rawText, hints);
      }, 'Phase 1');
    } catch (err) {
      console.warn('[GeminiProvider] Phase 1 failed, falling back to Local mode:', err);
      const localProvider = new LocalAnalysisProvider();
      const localBlueprint = await localProvider.analyzeAudioBuffer(audioBuffer);
      const analysisTime = Math.round(performance.now() - startTime);

      if (fileName) {
        ai.files.delete({ name: fileName }).catch(() => {});
      }

      return {
        ...localBlueprint,
        telemetry: {
          ...localBlueprint.telemetry,
          verificationNotes: 'Gemini Phase 1 failed - fell back to full Local DSP analysis.',
        },
        meta: {
          provider: 'gemini',
          analysisTime,
          sampleRate: features.sampleRate,
          duration: features.duration,
          channels: features.channels,
          llmEnhanced: false,
        },
      };
    }

    signal?.throwIfAborted();
    onProgress?.('Refining analysis (Phase 2)...');
    let phase2: GeminiPhase2Additions | null = null;

    try {
      phase2 = await withRetry(async () => {
        signal?.throwIfAborted();
        const baseP2 = buildPhase2Prompt(phase1, hints);
        const phase2Prompt = useJsonMode
          ? baseP2
          : baseP2 +
            '\n\nRespond with ONLY a single JSON object. Do not include any markdown formatting, commentary, or text outside the JSON.';
        const phase2Start = performance.now();

        const response = await ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: phase2Prompt }] }],
          config: useJsonMode
            ? { responseMimeType: 'application/json', temperature: 0 }
            : { temperature: 0 },
        });

        let rawText = response.text ?? '{}';
        if (!useJsonMode) {
          rawText = extractJsonFromText(rawText);
        }

        if (isDiagEnabled()) {
          addDiagnosticEntry({
            phase: 'phase2',
            model: modelId,
            modelPath: model,
            audioPartType: fileUri ? 'fileData' : 'inlineData',
            audioMimeType: file.type,
            fileUri: fileUri ?? undefined,
            promptLength: phase2Prompt.length,
            promptPreview: phase2Prompt.slice(0, 500),
            configSent: useJsonMode
              ? { responseMimeType: 'application/json' }
              : { responseMimeType: 'none (free-text)' },
            responseLength: rawText.length,
            responseFirst500: rawText.slice(0, 500),
            responseLast200: rawText.slice(-200),
            responseFullText: rawText,
            durationMs: Math.round(performance.now() - phase2Start),
          });
        }

        return parsePhase2Response(rawText);
      }, 'Phase 2');
    } catch (err) {
      console.warn('[GeminiProvider] Phase 2 failed, using Phase 1 results only:', err);
    }

    onProgress?.('Building blueprint...');
    const analysisTime = Math.round(performance.now() - startTime);
    const blueprint = assembleBlueprint(phase1, phase2, hints, features, analysisTime, modelId);

    finishAndDownloadReport(analysisTime);

    if (fileName) {
      ai.files.delete({ name: fileName }).catch((err) => {
        console.warn('[GeminiProvider] Failed to delete uploaded file:', err);
      });
    }

    return blueprint;
  }
}
