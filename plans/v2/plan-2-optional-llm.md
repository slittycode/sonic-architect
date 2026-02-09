# Plan 2 — Optional LLM Layer (Ollama / Local Models)

**Priority:** High — builds on Plan 1 to add richer interpretive analysis without requiring cloud APIs.  
**Depends on:** Plan 1 (Local Analysis Engine) for the `AnalysisProvider` abstraction and raw audio features.  
**Goal:** Users who want richer, more creative analysis text can plug in a local LLM via Ollama — but the app works perfectly without it.

---

## Why local LLM instead of Gemini

| Factor | Gemini API | Ollama (local) |
| --- | --- | --- |
| Cost | Pay per token | Free |
| Privacy | Audio sent to Google | Everything stays on machine |
| Latency | Network dependent | Local inference (3-15s for 7B models) |
| Offline | No | Yes |
| Audio understanding | Native multimodal | No — we feed it extracted features (text/JSON) |
| Setup | API key + billing | `brew install ollama && ollama pull llama3.2` |
| Quality ceiling | Higher (Pro is strong) | Lower but sufficient for structured prompts |

The key insight: **we don't need the LLM to "listen" to audio**. Plan 1's local DSP extracts all the quantitative data (BPM, key, spectral features, onsets). The LLM's job is limited to:

1. Interpreting the spectral data into natural language ("warm, analog-sounding sub bass")
2. Generating creative "secret sauce" tips based on detected characteristics
3. Suggesting Ableton workflows beyond the static device map

This is a text-in/text-out task that any decent 7B+ model handles well.

---

## Tasks

### 2.1 — Ollama HTTP client

Ollama exposes a local REST API at `http://localhost:11434`. Build a lightweight client:

```typescript
// services/ollamaClient.ts
export interface OllamaConfig {
  baseUrl: string;     // default: http://localhost:11434
  model: string;       // default: llama3.2
  temperature: number; // default: 0.3 (low for structured output)
}

export async function queryOllama(
  prompt: string,
  config: OllamaConfig
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      format: 'json',
      options: { temperature: config.temperature }
    })
  });
  if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
  const data = await response.json();
  return data.response;
}

export async function isOllamaAvailable(baseUrl = 'http://localhost:11434'): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(baseUrl = 'http://localhost:11434'): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/tags`);
  const data = await res.json();
  return data.models?.map((m: any) => m.name) ?? [];
}
```

### 2.2 — Build the `OllamaProvider`

Combines Plan 1's local DSP output with Ollama for interpretive text:

```typescript
// services/providers/ollamaProvider.ts
export class OllamaProvider implements AnalysisProvider {
  name = "Local LLM (Ollama)";

  async analyze(audioBuffer: AudioBuffer): Promise<ReconstructionBlueprint> {
    // Step 1: Run local DSP analysis (same as LocalAnalysisProvider)
    const features = await extractAudioFeatures(audioBuffer);
    const localBlueprint = buildBlueprintFromFeatures(features);

    // Step 2: Enhance with LLM interpretation
    const prompt = buildEnhancementPrompt(features, localBlueprint);
    const llmResponse = await queryOllama(prompt, this.config);
    const enhancements = JSON.parse(llmResponse);

    // Step 3: Merge — local data wins for quantitative fields, LLM enhances text
    return mergeBlueprints(localBlueprint, enhancements);
  }
}
```

The prompt sent to Ollama contains the actual extracted features, not raw audio:

```
You are an Ableton Live 12 expert. I have analyzed an audio file and extracted these features:

BPM: 128 (confidence: 0.97)
Key: F# Minor (confidence: 0.84)
Duration: 3:42
Spectral centroid mean: 2847 Hz
Sub bass energy: -12.3 dB (dominant)
Crest factor: 4.2 dB (moderate compression)
Detected onsets: 847 (dense rhythmic content)
Stereo width: 0.73 (wide)

Based on these measurements, enhance this reconstruction blueprint with:
1. Richer timbre descriptions for each instrument element
2. A "secret sauce" production technique and Ableton execution steps
3. More detailed FX chain reasoning

Return JSON matching this schema: { ... }
```

### 2.3 — Provider selection UI

Add a minimal settings panel (gear icon in header):

- **Auto-detect** (default): Check if Ollama is running; if yes, use it. If no, use local-only.
- **Local DSP only**: Fastest, always works, no LLM text
- **Ollama**: Select from detected models
- **Gemini (legacy)**: Requires API key, kept for users who prefer it

Store preference in `localStorage`. Show active provider in footer.

### 2.4 — Graceful fallback chain

```
Preferred provider → fallback → Local DSP (always works)
```

If Ollama is selected but not running, show a non-blocking toast: "Ollama not detected. Using local analysis. Run `ollama serve` to enable LLM features." and proceed with local-only analysis.

If Gemini is selected but no API key, same pattern.

The app **never blocks on a missing backend**.

### 2.5 — CLI model support via proxy

For users who prefer other local models (llama.cpp, LM Studio, text-generation-webui), support any OpenAI-compatible API endpoint:

```typescript
export interface LLMConfig {
  type: 'ollama' | 'openai-compatible';
  baseUrl: string;
  model: string;
  apiKey?: string;  // optional, for services that need it
}
```

This covers:
- Ollama (`http://localhost:11434`)
- LM Studio (`http://localhost:1234/v1`)
- llama.cpp server (`http://localhost:8080/v1`)
- Any OpenAI-compatible endpoint

### 2.6 — CSP update

The current CSP in `index.html` restricts `connect-src` to `self` and `generativelanguage.googleapis.com`. Add `localhost:*` for Ollama/local model support:

```
connect-src 'self' https://generativelanguage.googleapis.com http://localhost:*;
```

---

## What the user experiences

**Without Ollama (zero setup):**
- Upload audio, get analysis in 2-5 seconds
- BPM, key, arrangement sections with confidence scores
- Spectral-band instrumentation with Ableton device recommendations from knowledge base
- FX chain based on measured audio characteristics
- Secret sauce: template-based ("Dominant technique: Heavy sidechain compression detected. Try Ableton Compressor with sidechain input from kick, Attack 0.01ms, Release 200ms")

**With Ollama running:**
- Same quantitative data, but enriched with natural language descriptions
- "The sub bass has a warm, analog character with slight harmonic saturation — reminiscent of a Moog-style ladder filter"
- More creative secret sauce suggestions
- 5-15 seconds total (DSP + LLM inference)

**With Gemini (opt-in legacy):**
- Original behavior, fully multimodal analysis
- Requires API key configuration

---

## Recommended models for Ollama

| Model | Size | Speed | Quality for this task |
| --- | --- | --- | --- |
| `llama3.2:3b` | 2GB | Fast (2-5s) | Good for basic enhancement |
| `llama3.2` | 4.7GB | Medium (5-10s) | Good balance |
| `mistral` | 4.1GB | Medium (5-8s) | Strong structured output |
| `llama3.1:8b` | 4.7GB | Medium (5-10s) | Best quality at reasonable speed |
| `qwen2.5:7b` | 4.4GB | Medium (5-10s) | Excellent instruction following |
| `deepseek-r1:8b` | 4.9GB | Slower (10-20s) | Strongest reasoning |

Default recommendation: **`llama3.2`** — good enough, fast enough, runs on most machines (8GB RAM minimum).

---

## Risk assessment

| Risk | Mitigation |
| --- | --- |
| Ollama not installed | Local-only fallback works perfectly; show install instructions on first visit |
| Model produces invalid JSON | Parse with try/catch; fall back to local-only blueprint; retry once |
| LLM adds time to analysis | Show two-phase progress: "Analyzing audio... Generating descriptions..." |
| Users confused by provider options | Auto-detect by default; advanced users can override in settings |
| CORS issues with localhost | Ollama allows CORS by default; document `OLLAMA_ORIGINS` env var if needed |
