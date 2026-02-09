import { GoogleGenAI } from "@google/genai";
import { ReconstructionBlueprint } from "../types";

const getApiKey = (): string => {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (key == null || String(key).trim() === "") {
    throw new Error("Missing API key. Set GEMINI_API_KEY in .env.local.");
  }
  return String(key).trim();
};

function validateBlueprint(raw: unknown): asserts raw is ReconstructionBlueprint {
  if (raw == null || typeof raw !== "object") {
    throw new Error("Invalid analysis result; please try again.");
  }
  const o = raw as Record<string, unknown>;
  const telemetry = o.telemetry;
  if (telemetry == null || typeof telemetry !== "object") {
    throw new Error("Invalid analysis result; please try again.");
  }
  const t = telemetry as Record<string, unknown>;
  if (typeof t.bpm !== "string" || typeof t.key !== "string" || typeof t.groove !== "string") {
    throw new Error("Invalid analysis result; please try again.");
  }
  if (!Array.isArray(o.arrangement) || !Array.isArray(o.instrumentation) || !Array.isArray(o.fxChain)) {
    throw new Error("Invalid analysis result; please try again.");
  }
  const secretSauce = o.secretSauce;
  if (secretSauce == null || typeof secretSauce !== "object") {
    throw new Error("Invalid analysis result; please try again.");
  }
  const s = secretSauce as Record<string, unknown>;
  if (typeof s.trick !== "string" || typeof s.execution !== "string") {
    throw new Error("Invalid analysis result; please try again.");
  }
}

export const analyzeAudio = async (
  base64Audio: string,
  mimeType: string
): Promise<ReconstructionBlueprint> => {
  const apiKey = getApiKey();
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
        parts: [
          { inlineData: { data: base64Audio, mimeType } },
          { text: prompt }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      // We don't define responseSchema here to allow Pro model flexibility, 
      // but the prompt strictly requests the format.
    }
  });

  const text = response.text || "{}";
  // Strip markdown code blocks if present
  const cleanedText = text.replace(/```json\n|\n```/g, '').replace(/```/g, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON:", text);
    throw new Error("Could not parse analysis results. Please try again.");
  }
  validateBlueprint(parsed);
  return parsed;
};
