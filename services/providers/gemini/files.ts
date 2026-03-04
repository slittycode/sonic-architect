import { FileState, GoogleGenAI } from '@google/genai';
import type { Part } from '@google/genai';

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read audio file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload to Files API, poll until ACTIVE.
 * Returns { fileUri, fileName } for the uploaded file.
 */
export async function uploadToFilesAPI(
  ai: GoogleGenAI,
  file: File
): Promise<{ fileUri: string; fileName: string }> {
  const uploaded = await ai.files.upload({ file, config: { mimeType: file.type } });
  if (!uploaded.uri || !uploaded.name) {
    throw new Error('Gemini file upload returned no URI or name');
  }

  let fileInfo = uploaded;
  while (fileInfo.state === FileState.PROCESSING) {
    await new Promise((r) => setTimeout(r, 2000));
    fileInfo = await ai.files.get({ name: uploaded.name });
  }
  if (fileInfo.state === FileState.FAILED) {
    throw new Error('Gemini file processing failed');
  }
  if (!fileInfo.uri) {
    throw new Error('Gemini file processing returned no URI');
  }

  return { fileUri: fileInfo.uri, fileName: uploaded.name };
}

export function buildAudioPartFromUri(fileUri: string, mimeType: string): Part {
  return { fileData: { fileUri, mimeType } };
}

export function buildInlineAudioPart(base64: string, mimeType: string): Part {
  return { inlineData: { data: base64, mimeType } };
}
