
import { GoogleGenAI, Type } from "@google/genai";
import { ReconstructionBlueprint } from "../types";

export const analyzeAudio = async (
  base64Audio: string,
  mimeType: string
): Promise<ReconstructionBlueprint> => {
  const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

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
  try {
    return JSON.parse(cleanedText) as ReconstructionBlueprint;
  } catch (e) {
    console.error("Failed to parse Gemini response as JSON:", text);
    throw new Error("Could not parse analysis results. Please try again.");
  }
};
