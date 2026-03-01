/**
 * Discogs MAEST — Browser ML Genre Classification
 *
 * Uses Xenova/discogs-maest-30s-pw-73e-ts (Audio Spectrogram Transformer
 * fine-tuned on Discogs 400 music styles) via @huggingface/transformers.
 * Runs entirely in the browser via ONNX — no server required.
 *
 * Output labels follow the Discogs hierarchy, e.g.:
 *   "Electronic---Techno---Minimal Techno"
 *
 * Inference timeout is capped at 45 seconds so MAEST never blocks the
 * main analysis pipeline.
 */

const MODEL_ID = 'Xenova/discogs-maest-30s-pw-73e-ts';
const TARGET_SAMPLE_RATE = 16000;
const TIMEOUT_MS = 45_000;

export interface DiscogsMaestResult {
  topLabels: Array<{ label: string; score: number }>;
  primaryFamily: string;
  primarySubgenre: string;
  topScore: number;
}

// Lazy singleton — loaded once, reused across calls
let pipelinePromise: Promise<(audio: Float32Array, options: object) => Promise<unknown[]>> | null =
  null;

function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      return pipeline('audio-classification', MODEL_ID, { dtype: 'fp32' }) as unknown as (
        audio: Float32Array,
        options: object
      ) => Promise<unknown[]>;
    })();
  }
  return pipelinePromise;
}

/**
 * Downsample audio buffer to target sample rate via linear interpolation.
 * Returns a mono Float32Array at TARGET_SAMPLE_RATE.
 */
function resampleToMono(audioBuffer: AudioBuffer): Float32Array {
  const sourceRate = audioBuffer.sampleRate;
  const sourceSamples = audioBuffer.getChannelData(0);

  if (sourceRate === TARGET_SAMPLE_RATE) {
    return Float32Array.from(sourceSamples);
  }

  const ratio = sourceRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(sourceSamples.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, sourceSamples.length - 1);
    const frac = srcIdx - lo;
    output[i] = (sourceSamples[lo] ?? 0) * (1 - frac) + (sourceSamples[hi] ?? 0) * frac;
  }

  return output;
}

/**
 * Parse a Discogs hierarchy label like "Electronic---Techno---Minimal Techno"
 * into family and subgenre components.
 */
function parseLabel(label: string): { family: string; subgenre: string } {
  const parts = label.split('---');
  const family = parts[0]?.trim() ?? label;
  const subgenre = parts[parts.length - 1]?.trim() ?? label;
  return { family, subgenre };
}

/**
 * Classify audio using the Discogs MAEST model.
 * Returns null if the model fails to load or times out.
 */
export async function classifyDiscogsMaest(
  audioBuffer: AudioBuffer
): Promise<DiscogsMaestResult | null> {
  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), TIMEOUT_MS)
  );

  const classifyPromise = (async (): Promise<DiscogsMaestResult | null> => {
    try {
      const classify = await getPipeline();
      const audio = resampleToMono(audioBuffer);

      const raw = (await classify(audio, { top_k: 10 })) as Array<{
        label: string;
        score: number;
      }>;

      if (!Array.isArray(raw) || raw.length === 0) return null;

      const topLabels = raw.map((r) => ({ label: r.label, score: r.score }));
      const top = raw[0];
      const { family, subgenre } = parseLabel(top.label);

      return {
        topLabels,
        primaryFamily: family,
        primarySubgenre: subgenre,
        topScore: top.score,
      };
    } catch (err) {
      console.warn('[DiscogsMaest] Classification failed:', err);
      return null;
    }
  })();

  return Promise.race([classifyPromise, timeoutPromise]);
}
