import { GoogleGenAI } from '@google/genai';
import { AnalysisProvider, ReconstructionBlueprint } from '../types';
import { validateBlueprint } from './blueprintValidation';

/**
 * Gemini Provider — Cloud-based multimodal analysis.
 * Requires VITE_GEMINI_API_KEY. Kept as opt-in legacy provider.
 */
export class GeminiProvider implements AnalysisProvider {
  name = 'Gemini 1.5 Pro (Cloud)';
  type = 'gemini' as const;

  async isAvailable(): Promise<boolean> {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    return typeof key === 'string' && key.length > 0;
  }

  async analyze(file: File): Promise<ReconstructionBlueprint> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing API key. Set GEMINI_API_KEY in .env.local to use the Gemini provider.'
      );
    }

    const startTime = performance.now();

    // Read file as base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string).split(',')[1];
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read audio file.'));
      reader.readAsDataURL(file);
    });

    const result = await analyzeAudioWithGemini(base64, file.type, apiKey);
    const analysisTime = Math.round(performance.now() - startTime);

    return {
      ...result,
      meta: {
        provider: 'gemini',
        analysisTime,
        sampleRate: 0, // Unknown from Gemini
        duration: 0,
        channels: 0,
      },
    };
  }
}

/**
 * Core Gemini API call — kept as standalone for backward compatibility.
 */
async function analyzeAudioWithGemini(
  base64Audio: string,
  mimeType: string,
  apiKey: string
): Promise<ReconstructionBlueprint> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a world-class Audio Engineer and Electronic Music Producer expert in Ableton Live 12.
  Analyze this audio file and deconstruct it into a "Reconstruction Blueprint".
  
  Provide a highly technical analysis focusing on signal path, synthesis, and Ableton-specific devices.
  
  You must return the response in JSON format according to this schema:
  {
    "telemetry": {
      "bpm": "Exact BPM estimate",
      "key": "Root and Scale",
      "groove": "Description of swing/timing"
    },
    "arrangement": [
      { "timeRange": "0:00-0:15", "label": "Intro", "description": "Specific energy dynamics" }
    ],
    "instrumentation": [
      { 
        "element": "e.g. Sub Bass", 
        "timbre": "Analysis of the sound texture", 
        "frequency": "Placement in the spectrum", 
        "abletonDevice": "Exact Ableton 12 device and settings" 
      }
    ],
    "fxChain": [
      { "artifact": "Processing observed", "recommendation": "Ableton FX recommendation" }
    ],
    "secretSauce": {
      "trick": "The unique production technique used",
      "execution": "Step-by-step how to recreate it in Ableton"
    }
  }`;

  const response = await ai.models.generateContent({
    model: 'gemini-1.5-pro',
    contents: [
      {
        parts: [{ inlineData: { data: base64Audio, mimeType } }, { text: prompt }],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text || '{}';
  const cleanedText = text.replace(/```json\n|\n```/g, '').replace(/```/g, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch {
    console.error('Failed to parse Gemini response as JSON:', text);
    throw new Error('Could not parse analysis results. Please try again.');
  }

  try {
    return validateBlueprint(parsed);
  } catch (error) {
    console.error('Gemini response failed blueprint validation:', error);
    throw new Error('Invalid analysis result; please try again.');
  }
}

// Legacy export for backward compatibility
export const analyzeAudio = async (
  base64Audio: string,
  mimeType: string
): Promise<ReconstructionBlueprint> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
  return analyzeAudioWithGemini(base64Audio, mimeType, apiKey);
};
