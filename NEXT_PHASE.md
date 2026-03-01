# AI Model Investigation & Improvement Plan for Sonic Architect

## Problem Statement

Sonic Architect currently uses **Gemini 2.0 Flash** and **Gemini 2.5 Flash** (default) for cloud-based audio enrichment. The question is: are there better-suited models — including AWS Bedrock options — and can we give users a richer selection of models to choose from?

---

## What the LLMs Actually Do (Scope)

The local DSP engine handles all objective measurements (BPM, key, chords, spectral bands, LUFS). The LLM's role is:

1. **Audio Enhancement** — Listen to the raw audio + review DSP measurements → enrich groove/timbre/Ableton device descriptions
2. **Verification** — Independently re-verify BPM/key/genre classification with confidence scores against the audio
3. **Chat** — Answer production questions using the blueprint as context

Only tasks 1 and 2 actually benefit from native audio understanding. Task 3 is text-only (blueprint JSON context).

---

## Investigation Findings

### Current State

| Provider | Model              | Audio Input  | Notes                                           |
| -------- | ------------------ | ------------ | ----------------------------------------------- |
| Gemini   | gemini-2.5-flash   | ✅ Native    | Default; good speed/cost balance                |
| Gemini   | gemini-2.0-flash   | ✅ Native    | Older/cheaper option                            |
| Claude   | claude-opus-4-6    | ❌ Text only | Blueprint JSON only, no audio — skipped for now |
| Ollama   | llama3.2 (default) | ❌ Text only | Local; JSON blueprint only                      |

### AWS Bedrock — Investigation Result: Not Suitable

Bedrock was investigated as a potential provider. **Conclusion: not suitable for this use case.**

Bedrock does not give any foundation model raw audio input. Its audio workflow is:

1. Upload audio to S3
2. Transcribe via Amazon Transcribe or Whisper (speech → text)
3. Pass transcript text to a Bedrock LLM

This speech-transcription approach doesn't work for music analysis — you can't transcribe a music track into anything useful for production analysis. Bedrock's models (Claude on Bedrock, Llama, Mixtral, Amazon Nova) do not receive or reason about audio waveforms. **Bedrock is not recommended.**

### Model Landscape Assessment

#### 1. Gemini 2.5 Pro (highest-impact quick win)

- **Audio**: ✅ Native (same as Flash but deeper reasoning)
- **Vs Flash**: Benchmarks consistently show Pro outperforms Flash on deep reasoning + multimodal accuracy
- **Cost**: ~3-4x higher than Flash per token
- **Integration**: Zero code changes to the provider — just add a new model ID constant
- **Verdict**: Best bang-for-buck improvement. Ideal for users who want maximum quality.

#### 2. OpenAI GPT-4o Audio (best alternative provider)

- **Audio**: ✅ Native multimodal (base64 audio in `/chat/completions`)
- **Strengths**: Strong genre/mood/vocal analysis; natural audio dialogue; 128k context
- **No 20 MB cap issue**: Sends base64 chunks rather than inline file upload
- **Cost**: Higher than Gemini Flash, comparable to Gemini Pro
- **Integration**: New `services/openaiProvider.ts` + `api/openai.ts` edge function proxy (mirrors `api/claude.ts`)
- **Verdict**: The only other frontier model with native audio understanding. Worth adding as a provider.

#### 3. Qwen2-Audio via Ollama (best local upgrade)

- **Audio**: ✅ Purpose-built audio-language model (Alibaba, open source)
- **Strengths**: Specifically benchmarked on music tasks (MusicCaps, MMAR); outperforms Gemini 1.5 Pro on audio benchmarks; 7B params runs locally
- **Integration**: Available via Ollama (`qwen2-audio`) — user would `ollama pull qwen2-audio`
- **Verdict**: Best option for users who want privacy/offline use. Huge quality upgrade over llama3.2 for audio tasks.

#### 4. Gemini — Prompt Engineering (free improvement)

- The verification prompt could be more specific about Ableton 12 devices and genre-specific instrumentation
- The enhancement prompt could explicitly request MIDI note ranges, synthesis patch parameters, and sidechain compression tips

---

## Recommendations (Priority Order)

| Priority | Change                                               | Effort | Impact             |
| -------- | ---------------------------------------------------- | ------ | ------------------ |
| 1        | Add `gemini-2.5-pro` as model option                 | Low    | Medium-High        |
| 2        | Add OpenAI provider (GPT-4o audio)                   | Medium | High               |
| 3        | Add Qwen2-Audio to Ollama model list + documentation | Low    | High (local users) |
| 4        | Refine prompts (Gemini + Ollama providers)           | Low    | Medium             |

---

## Implementation Todos

1. **add-gemini-pro** — Add `gemini-2.5-pro` to `GeminiModelId` type and `GEMINI_MODEL_LABELS` in `services/geminiService.ts`
2. **openai-api-proxy** — Create `api/openai.ts` Vercel Edge Function proxy (mirrors `api/claude.ts`); add dev proxy in `vite.config.ts`
3. **openai-provider** — Create `services/openaiProvider.ts` implementing `AnalysisProvider` with GPT-4o audio input (local DSP first → GPT-4o enrichment); wire into `App.tsx` provider selection
4. **qwen2-audio-ollama** — Add `qwen2-audio` as a recommended model option in the Ollama provider UI/config with setup instructions
5. **prompt-improvements** — Refine enhancement and verification prompts to request MIDI note ranges, synthesis patch parameters, sidechain tips, and genre-specific Ableton 12 device chains

---

## Notes

- The hybrid DSP-first architecture is excellent and should not change. LLMs are only for enrichment/verification.
- The 20 MB Gemini inline limit is a real constraint — large audio files skip cloud enrichment entirely. GPT-4o base64 approach is more flexible for larger files.
- AWS Bedrock is definitively not suitable — no model on Bedrock can process raw music audio.
- Qwen2-Audio is the most interesting option for power users: a purpose-built music AI running locally, no API costs.
