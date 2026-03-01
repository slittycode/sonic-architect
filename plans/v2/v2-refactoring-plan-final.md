# Sonic Architect V2 Refactoring Plan — Final Amended

**Date:** 1 March 2026
**Status:** Approved — pending implementation
**Branch:** To be implemented on a new branch `v2-gemini-primary`

---

## 0. Amendments Log

### Original V2 Plan (1 March 2026)

Initial plan covering Gemini-primary architecture, archive strategy, Local mode preservation.

### Amendments from Claude Code Review (1 March 2026)

1. **`spectralTimeline` added to `LocalDSPHints`** — prevents broken SpectralAreaChart + SpectralHeatmap visualizations in Gemini mode.
2. **Zod schema validation** added (Section 4e) — handles all Gemini response edge cases with per-field fallbacks.
3. **Additional files archived** — `ollamaClient.ts`, `azureOpenAIProvider.ts`, `api/claude.ts`, plus 2 test files.
4. **2 test files rewritten** — `App.providerFallback.test.tsx` (Gemini→Local fallback), `ChatPanel.test.tsx` (Gemini-only chat).
5. **New test suite** — `geminiProvider.test.ts` + `geminiSchemas.test.ts`.
6. **"Lightweight DSP" renamed to "base DSP"** — honest naming; saves ~10-15% not ~50%.
7. **Chat works in Local mode** if a Gemini API key exists (analysis is local, but chat uses Gemini).
8. **Gemini model selector kept** in UI (7 models, default `gemini-2.5-flash`).
9. **Always use Files API** for audio upload — upload once, reference in both Phase 1 and Phase 2, delete after.
10. **Phase 2 keeps audio** (per user request) — cost mitigated by Files API reuse.

### Rejected Recommendations

- **Split Phase 1 into two calls** — Gemini 2.5 handles large structured JSON well; splitting adds latency and cost. Zod validation with fallbacks is the better fix.
- **Make Phase 2 text-only** — User explicitly requested audio in Phase 2 for quality. Files API reuse eliminates the bandwidth concern.
- **IndexedDB result caching** — Premature for proof of concept. Deferred to post-v2.

---

## 1. Design Principles (Immutable)

1. **Gemini is the primary sonic analyzer.** It receives raw audio and returns the authoritative analysis.
2. **Local DSP is a supporting role in Gemini mode.** It provides waveform data, BPM/key hints, spectral measurements for visualization, and chord progression hints.
3. **Local DSP is the FULL engine in Local mode.** When no Gemini API key is present (or the user selects "Local"), the current complete pipeline runs unchanged — all 8 specialized detectors, genre classification, Mix Doctor, everything.
4. **Phase 2 is a refinement pass, not a replacement.** It receives the audio again + all prior analysis, and improves text quality, device recommendations, and Ableton-specific guidance. It only overrides measured values if >50% confidence the prior value is wrong.
5. **The user's top 3 valued outputs are:** (a) MIDI transcription via Session Musician, (b) the 5 core blueprint sections (Global Telemetry, Instrumentation & Synthesis, Effects Chain, Arrangement, Secret Sauce), (c) synth preset generation via Patch Smith.
6. **No hard deletes.** All removed files go to `archive/v1/` to preserve restoration capability.

---

## 2. Files to ARCHIVE (moved to `archive/v1/`)

These files are moved out of the active codebase. Their functionality either moves to Gemini or is confirmed drift. They remain accessible for reference or restoration.

| File                                        | Archive Reason                             |
| ------------------------------------------- | ------------------------------------------ |
| `services/abletonParser.ts`                 | Confirmed drift (.als parsing)             |
| `services/discogsMaest.ts`                  | Replaced by Gemini genre classification    |
| `services/claudeProvider.ts`                | Provider consolidation                     |
| `services/openaiProvider.ts`                | Provider consolidation                     |
| `services/ollamaProvider.ts`                | Provider consolidation                     |
| `services/ollamaClient.ts`                  | Companion to ollamaProvider.ts             |
| `services/azureOpenAIProvider.ts`           | Provider consolidation                     |
| `api/openai.ts`                             | No longer needed (OpenAI provider removed) |
| `api/azure-openai.ts`                       | No longer needed                           |
| `api/claude.ts`                             | No longer used; chat is Gemini-only        |
| `services/gemini/prompts/audioAnalysis.ts`  | Replaced by `phase1Analysis.ts`            |
| `services/gemini/prompts/deviceChains.ts`   | Replaced by `phase2Refinement.ts`          |
| `services/__tests__/claudeProvider.test.ts` | Tests archived provider                    |
| `services/__tests__/ollamaClient.test.ts`   | Tests archived provider                    |

### Files that stay in-place and active (Local mode still uses them):

| File                                  | Why it stays                                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/audioAnalysis.ts`           | **Critical** — provides spectral bands, spectral timeline (heatmap), waveform data, BPM, key, RMS, onsets, MFCC, LUFS, stereo analysis. Used by BOTH modes. |
| `services/bpmDetection.ts`            | BPM detection — used by both modes                                                                                                                          |
| `services/keyDetection.ts`            | Key detection — used by both modes                                                                                                                          |
| `services/hpss.ts`                    | HPSS — used by both modes (chord detection input)                                                                                                           |
| `services/chordDetection.ts`          | Chord progression — used by both modes                                                                                                                      |
| `services/essentiaFeatures.ts`        | Essentia WASM features — used by both modes                                                                                                                 |
| `services/genreClassifier.ts`         | Legacy rule-based genre classifier — imported by localProvider.ts as fallback                                                                               |
| `services/genreClassifierEnhanced.ts` | Orchestrator for 8 detectors — used by Local mode only                                                                                                      |
| `services/sidechainDetection.ts`      | Local mode genre classifier                                                                                                                                 |
| `services/acidDetection.ts`           | Local mode genre classifier                                                                                                                                 |
| `services/kickAnalysis.ts`            | Local mode genre classifier                                                                                                                                 |
| `services/reverbAnalysis.ts`          | Local mode genre classifier                                                                                                                                 |
| `services/supersawDetection.ts`       | Local mode genre classifier                                                                                                                                 |
| `services/vocalDetection.ts`          | Local mode genre classifier                                                                                                                                 |
| `services/bassAnalysis.ts`            | Local mode genre classifier                                                                                                                                 |
| `services/mixDoctor.ts`               | Local mode mix analysis                                                                                                                                     |
| `services/stereoAnalysis.ts`          | Imported by audioAnalysis.ts — stereo width/correlation                                                                                                     |
| `services/loudness.ts`                | Imported by audioAnalysis.ts — LUFS/true peak                                                                                                               |
| `data/genreProfiles.ts`               | Used by Local mode's Mix Doctor                                                                                                                             |
| `data/abletonDevices.ts`              | Device mapping reference — used by Local mode, available as fallback                                                                                        |

---

## 3. Files to KEEP (unchanged or minor edits)

| File                           | Role                                                   | Changes                                           |
| ------------------------------ | ------------------------------------------------------ | ------------------------------------------------- |
| `services/audioAnalysis.ts`    | Decode audio, extract base features, spectral timeline | **No change**                                     |
| `services/bpmDetection.ts`     | Autocorrelation BPM                                    | No change                                         |
| `services/keyDetection.ts`     | Krumhansl-Schmuckler key                               | No change                                         |
| `services/hpss.ts`             | Harmonic/Percussive separation                         | No change                                         |
| `services/chordDetection.ts`   | Chord progression analysis                             | No change                                         |
| `services/essentiaFeatures.ts` | Essentia WASM features                                 | No change                                         |
| `services/pitchDetection.ts`   | YIN monophonic pitch (Session Musician)                | No change                                         |
| `services/polyphonicPitch.ts`  | Basic Pitch WASM                                       | Keep, hide from UI (future polyphonic mode)       |
| `services/midiExport.ts`       | MIDI file generation                                   | No change                                         |
| `services/midiPreview.ts`      | MIDI playback                                          | No change                                         |
| `services/patchSmith.ts`       | Vital/Operator presets                                 | No change                                         |
| `services/exportBlueprint.ts`  | Blueprint export                                       | No change                                         |
| `services/quantization.ts`     | Beat quantization                                      | No change                                         |
| `services/localProvider.ts`    | Full Local mode engine                                 | **No change** — retains all current functionality |
| `services/chatService.ts`      | Chat panel                                             | Strip non-Gemini backends; see Section 12         |

---

## 4. The New Gemini Pipeline — Detailed Specification

### 4a. Audio Upload (parallel with DSP)

**Strategy:** Always use the Gemini Files API, regardless of file size.

```
Upload audio file → Files API → poll until ACTIVE → store fileUri
```

This runs **in parallel** with the base DSP pass. The file URI is referenced in both Phase 1 and Phase 2, then deleted after Phase 2 completes (or on error).

Benefits:

- Single upload, dual reference — no base64 doubling
- Cleaner error handling
- Works for all file sizes uniformly

### 4b. Base DSP Pass (parallel with upload)

**File:** `services/gemini/geminiProvider.ts` (internal helper function)

When the user selects Gemini, a **base DSP pass** runs — the same feature extraction as the full pipeline minus the 8 specialized genre detectors, Mix Doctor, and Discogs MAEST:

```
┌─────────────────────────────────────────────────┐
│ decodeAudioFile(file)                           │
│   → AudioBuffer (for waveform visualizer)       │
├─────────────────────────────────────────────────┤
│ extractAudioFeatures(audioBuffer)               │
│   → BPM (hint), key (hint), spectral bands,    │
│     spectralTimeline, RMS envelope, onsets,     │
│     MFCC, LUFS, true peak, stereo correlation,  │
│     stereo width, mono compatible               │
├─────────────────────────────────────────────────┤
│ extractEssentiaFeatures(audioBuffer)            │
│   → dissonance, HFC, spectral complexity,       │
│     ZCR (supplementary hints)                   │
├─────────────────────────────────────────────────┤
│ performHPSS(audioBuffer) → harmonicSignal       │
│ detectChords(harmonicSignal) → chords           │
│   → chord progression (hint to Gemini)          │
└─────────────────────────────────────────────────┘
```

**Output:** A `LocalDSPHints` object:

```typescript
interface LocalDSPHints {
  bpm: number;
  bpmConfidence: number;
  key: string;
  keyConfidence: number;
  spectralBands: SpectralBandEnergy[];
  spectralTimeline: SpectralTimeline; // Required for SpectralAreaChart + SpectralHeatmap
  rmsEnvelope: number[];
  onsets: number[];
  mfcc: number[][];
  chordProgression: ChordEvent[];
  essentiaFeatures?: EssentiaFeatures;
  lufsIntegrated?: number;
  truePeak?: number;
  stereoCorrelation?: number;
  stereoWidth?: number;
  monoCompatible?: boolean;
  duration: number;
  sampleRate: number;
  channelCount: number;
}
```

This is functionally ~85-90% of the current pipeline's computation. What it skips: the 8 genre detectors (~10-15% of time), Mix Doctor comparison, Discogs MAEST ML model. The purpose is not speed savings — it's avoiding analyses that Gemini replaces with better results.

### 4c. Gemini Phase 1: Primary Sonic Analysis (audio + hints)

**Input to Gemini:**

- Audio file reference (Files API URI)
- `LocalDSPHints` as JSON context in the prompt
- Prompt explains local DSP values are _hints_ — Gemini should use its own judgment

**Prompt asks Gemini to return** (structured JSON via `responseMimeType: 'application/json'`):

```typescript
interface GeminiPhase1Response {
  // Global Telemetry
  bpm: number;
  bpmConfidence: number;
  key: string;
  keyConfidence: number;
  timeSignature: string;
  genre: string;
  subGenre: string;
  groove: string; // e.g. "four-on-the-floor", "broken beat", "swing"
  grooveDescription: string;
  energy: number; // 0-1

  // Chord Progression
  chordProgression: {
    chords: Array<{ chord: string; startTime: number; duration: number }>;
    summary: string; // e.g. "i-VI-III-VII progression in Am, typical of melodic techno"
  };

  // Sonic Character Per Element
  elements: Array<{
    name: string; // e.g. "Sub-Bass", "Kick", "Lead Synth", "Pad", "Hi-Hats", "Vocals"
    frequencyRange: string; // e.g. "20-80 Hz"
    sonicCharacter: string; // descriptive text of what it sounds like
    howToRecreate: string; // Ableton Live 12 specific instructions
    suggestedDevices: string[]; // e.g. ["Operator", "Saturator", "Auto Filter"]
    role: string; // e.g. "foundation", "rhythm", "melody", "texture"
  }>;

  // Presence Detection (replaces the 8 local detectors in Gemini mode)
  detectedCharacteristics: {
    sidechain: { present: boolean; description: string; strength: string };
    acidResonance: { present: boolean; description: string };
    reverbCharacter: { present: boolean; description: string; estimatedDecay: string };
    distortion: { present: boolean; description: string; type: string };
    supersawLayers: { present: boolean; description: string };
    vocalPresence: { present: boolean; description: string; type: string };
    bassCharacter: { description: string; type: string };
    groove: { swingAmount: string; description: string };
  };

  // Arrangement
  arrangement: Array<{
    section: string; // "intro", "buildup", "drop", "breakdown", "verse", "chorus", "outro"
    startTime: number;
    endTime: number;
    description: string;
    energyLevel: number; // 0-1
  }>;

  // Instrumentation & Synthesis
  instrumentation: Array<{
    name: string;
    type: string; // "synth", "sample", "acoustic", "vocal"
    description: string;
    abletonDevice: string; // primary device
    deviceChain: string[]; // full chain including effects
    presetSuggestion: string; // starting point preset name
    parameterNotes: string; // key parameter settings
  }>;

  // Effects Chain
  effectsChain: Array<{
    name: string;
    type: string; // "reverb", "delay", "distortion", "filter", "compressor", etc.
    purpose: string;
    abletonDevice: string;
    settings: string;
  }>;

  // Secret Sauce
  secretSauce: {
    technique: string;
    description: string;
    abletonImplementation: string;
  };

  // Genre Classification
  genreAnalysis: {
    primary: string;
    secondary: string[];
    confidence: number;
    reasoning: string;
  };
}
```

**Key behaviors:**

- Gemini may disagree with local DSP BPM/key — Gemini's values are authoritative (it heard the audio).
- The `elements` array is open-ended — Gemini identifies as many distinct sonic elements as it hears.
- The `howToRecreate` field per element is the high-value Ableton Live 12 specific instruction text.
- Groove analysis and chord progression are explicitly requested.

### 4d. Gemini Phase 2: Refinement Pass (audio + Phase 1 + local DSP)

**Input to Gemini:**

- Audio file reference (same Files API URI — no re-upload)
- Complete Phase 1 response as JSON
- Complete `LocalDSPHints` as JSON
- Refinement-focused prompt

**Prompt instructs Gemini to:**

1. **Listen to the audio again** with the Phase 1 analysis in front of it
2. **Verify** BPM, key, genre — only override if >50% confident Phase 1 was wrong
3. **Enrich** all descriptive text — make `howToRecreate` more specific, add parameter values
4. **Add** anything Phase 1 missed — additional sonic elements, effects, arrangement nuances
5. **Provide mix feedback** — assess spectral balance, stereo field, dynamics relative to the identified genre (replaces Mix Doctor in Gemini mode)
6. **Ensure Ableton Live 12 accuracy** — correct any device names, parameter names, or workflow suggestions

**Phase 2 returns the same full schema as Phase 1** plus:

```typescript
interface GeminiPhase2Additions {
  // Mix Feedback (replaces Mix Doctor in Gemini mode)
  mixFeedback: {
    overallAssessment: string;
    spectralBalance: string;
    stereoField: string;
    dynamics: string;
    lowEnd: string;
    highEnd: string;
    suggestions: string[];
  };

  // Corrections from Phase 1 (only applied if confidence > 0.5)
  corrections: Array<{
    field: string;
    originalValue: string;
    correctedValue: string;
    confidence: number;
    reasoning: string;
  }>;

  // Additional elements not caught in Phase 1
  additionalElements: Array<{
    name: string;
    frequencyRange: string;
    sonicCharacter: string;
    howToRecreate: string;
    suggestedDevices: string[];
    role: string;
  }>;
}
```

### 4e. Schema Validation Strategy (Zod)

All Gemini responses are validated using Zod schemas with coercion and fallbacks:

**Zod Schema Design:**

- `z.coerce.number()` for all numeric fields — handles `"128"` → `128`
- `.default()` for optional fields with sensible defaults
- `.catch()` on individual fields to provide per-field fallbacks
- `.safeParse()` at the top level — if full parsing fails, log raw response

**Fallback Chain:**

1. If `safeParse()` succeeds → use validated response
2. If `safeParse()` fails but raw JSON is parseable → attempt partial extraction of key fields (bpm, key, genre, elements) with individual field validation
3. If JSON itself is malformed → attempt truncated JSON repair (close open brackets/braces) and re-parse
4. If all parsing fails → fall back to Local mode with warning in UI

**Per-field Fallbacks (when partial response):**

- `bpm` missing/invalid → use local DSP hint value
- `key` missing/invalid → use local DSP hint value
- `elements` missing → empty array
- `arrangement` missing → empty array
- `instrumentation` missing → empty array
- `effectsChain` missing → empty array
- `secretSauce` missing → placeholder: `{ technique: "Not detected", description: "Gemini did not return secret sauce analysis.", abletonImplementation: "" }`
- `detectedCharacteristics` missing → all `{ present: false }`
- `genreAnalysis` missing → `{ primary: "Unknown", secondary: [], confidence: 0, reasoning: "Not available" }`

**Phase 2 Corrections Validation:**

- Each correction must have `confidence > 0.5` to be applied
- Corrections with missing confidence field are ignored
- Corrections are logged for debugging (attached to blueprint as `geminiPhase2.corrections`)

### 4f. Blueprint Assembly

After Phase 2 completes:

1. Start with Phase 1 validated response as base
2. Apply Phase 2 corrections where confidence > 0.5
3. Merge Phase 2 additional elements into the elements array
4. Replace Phase 1 descriptive text with Phase 2 enriched text where provided
5. Add Phase 2 mix feedback
6. Attach local DSP data for visualizations:
   - `spectralTimeline` → SpectralAreaChart + SpectralHeatmap
   - `spectralBands` → spectral display
   - `rmsEnvelope` → waveform
   - Stereo/loudness metrics
7. Set `meta.provider = 'gemini'`, timing info, model used
8. Delete uploaded file from Files API (fire-and-forget)

---

## 5. Local Mode — No Changes to Current Depth

**Critical commitment:** When the user selects "Local (offline)" or has no Gemini API key, the FULL current pipeline runs as-is:

| Pipeline Stage                                                                                     | Runs in Local Mode? | Runs in Gemini Mode?     |
| -------------------------------------------------------------------------------------------------- | ------------------- | ------------------------ |
| `audioAnalysis.ts` (decode, BPM, key, spectral, spectralTimeline, RMS, onsets, MFCC, LUFS, stereo) | ✅ Full             | ✅ Full (hints + viz)    |
| `essentiaFeatures.ts` (WASM features)                                                              | ✅                  | ✅ (hints)               |
| `hpss.ts` (Harmonic/Percussive separation)                                                         | ✅                  | ✅ (hints)               |
| `chordDetection.ts` (chord progressions)                                                           | ✅                  | ✅ (hints)               |
| `genreClassifierEnhanced.ts` (8 specialized detectors)                                             | ✅                  | ❌ (Gemini handles)      |
| `sidechainDetection.ts`                                                                            | ✅                  | ❌                       |
| `acidDetection.ts`                                                                                 | ✅                  | ❌                       |
| `kickAnalysis.ts`                                                                                  | ✅                  | ❌                       |
| `reverbAnalysis.ts`                                                                                | ✅                  | ❌                       |
| `supersawDetection.ts`                                                                             | ✅                  | ❌                       |
| `vocalDetection.ts`                                                                                | ✅                  | ❌                       |
| `bassAnalysis.ts`                                                                                  | ✅                  | ❌                       |
| `mixDoctor.ts` (spectral comparison)                                                               | ✅                  | ❌ (Gemini mix feedback) |
| `data/genreProfiles.ts`                                                                            | ✅                  | ❌                       |
| `polyphonicPitch.ts` (Basic Pitch)                                                                 | ✅ (internal)       | ❌                       |
| `pitchDetection.ts` (YIN / Session Musician)                                                       | ✅                  | ✅                       |
| `data/abletonDevices.ts` (device mapping)                                                          | ✅                  | ✅ (fallback)            |

`services/localProvider.ts` is **NOT modified**. It remains the full-featured engine it is today.

---

## 6. Type Changes in `types.ts`

### New Types (additive only):

```typescript
interface LocalDSPHints {
  bpm: number;
  bpmConfidence: number;
  key: string;
  keyConfidence: number;
  spectralBands: SpectralBandEnergy[];
  spectralTimeline: SpectralTimeline;
  rmsEnvelope: number[];
  onsets: number[];
  mfcc: number[][];
  chordProgression: ChordEvent[];
  essentiaFeatures?: EssentiaFeatures;
  lufsIntegrated?: number;
  truePeak?: number;
  stereoCorrelation?: number;
  stereoWidth?: number;
  monoCompatible?: boolean;
  duration: number;
  sampleRate: number;
  channelCount: number;
}

interface MixFeedback {
  overallAssessment: string;
  spectralBalance: string;
  stereoField: string;
  dynamics: string;
  lowEnd: string;
  highEnd: string;
  suggestions: string[];
}

interface SonicElement {
  name: string;
  frequencyRange: string;
  sonicCharacter: string;
  howToRecreate: string;
  suggestedDevices: string[];
  role: string;
}

interface DetectedCharacteristics {
  sidechain?: { present: boolean; description: string; strength?: string };
  acidResonance?: { present: boolean; description: string };
  reverbCharacter?: { present: boolean; description: string; estimatedDecay?: string };
  distortion?: { present: boolean; description: string; type?: string };
  supersawLayers?: { present: boolean; description: string };
  vocalPresence?: { present: boolean; description: string; type?: string };
  bassCharacter?: { description: string; type?: string };
  groove?: { swingAmount?: string; description: string };
}

interface GenreAnalysis {
  primary: string;
  secondary: string[];
  confidence: number;
  reasoning: string;
}
```

### Modifications to existing types (additive — no fields removed):

**`ReconstructionBlueprint`** — add optional fields:

```typescript
interface ReconstructionBlueprint {
  // ...all existing fields remain unchanged...

  // NEW: Gemini-powered mix feedback (Gemini mode only)
  mixFeedback?: MixFeedback;

  // EXISTING: mixReport stays for Local mode
  mixReport?: MixDoctorReport;

  // NEW: raw Gemini responses for debugging/export
  geminiPhase1?: object;
  geminiPhase2?: object;
}
```

**`GlobalTelemetry`** — add optional fields:

```typescript
interface GlobalTelemetry {
  // ...all existing fields remain unchanged...

  // NEW: Gemini sonic element breakdown
  elements?: SonicElement[];

  // NEW: Gemini detected characteristics
  detectedCharacteristics?: DetectedCharacteristics;

  // NEW: Gemini genre analysis
  genreAnalysis?: GenreAnalysis;

  // NEW: groove info
  groove?: string;
  grooveDescription?: string;

  // NEW: chord progression from Gemini
  chordProgression?: {
    chords: Array<{ chord: string; startTime: number; duration: number }>;
    summary: string;
  };
}
```

**No existing fields are removed.** Local mode still populates `sidechainAnalysis`, `kickAnalysis`, etc. Gemini mode populates the new fields. The UI checks which fields are present to decide what to render.

---

## 7. UI Changes in `App.tsx`

### Provider Selector

Replace the current multi-provider dropdown with two options:

- **"Gemini (recommended)"** — requires `VITE_GEMINI_API_KEY`
- **"Local (offline)"** — no API key needed, runs full DSP pipeline

### Gemini Model Selector

Keep the existing model selector dropdown showing all 7 Gemini models, grouped by category (experimental / stable / preview). Default: `gemini-2.5-flash`. Visible only when Gemini provider is selected.

### Analysis Flow (Gemini mode)

```
User clicks "Analyze"
  │
  ├─► In parallel:
  │   ├─► Show progress: "Uploading audio..."
  │   │     └─► Files API upload (variable, depends on file size)
  │   └─► Show progress: "Decoding audio..."
  │         └─► Base DSP pass (1-2 sec)
  │
  ├─► Show progress: "Analyzing with Gemini (Phase 1)..."
  │     └─► Gemini Phase 1 (5-15 sec depending on file size)
  │
  ├─► Show progress: "Refining analysis (Phase 2)..."
  │     └─► Gemini Phase 2 (5-10 sec)
  │
  └─► Show progress: "Building blueprint..."
        └─► Assembly + display
```

### Analysis Flow (Local mode)

Unchanged from current behavior.

### Polyphonic Mode

Remove the `polyMode` toggle from the UI. Keep the code. Add "Polyphonic mode coming soon" note in Session Musician section.

---

## 8. UI Changes in `BlueprintDisplay.tsx`

### Mix Feedback Section (was "Mix Doctor")

- **Gemini mode:** Renders `blueprint.mixFeedback` as prose — overall assessment, spectral balance narrative, stereo field, dynamics, low/high end, actionable suggestions. Section title: **"Mix Feedback"**.
- **Local mode:** Renders `blueprint.mixReport` with existing numeric scores/grades. Section title: **"Mix Feedback"** (same title, different content format).

### Enhanced Analysis / Detected Characteristics

- **Gemini mode:** Renders `telemetry.detectedCharacteristics` as descriptive cards. Each card shows: characteristic name, present yes/no, Gemini's description, strength/type where applicable.
- **Local mode:** Renders existing detector sub-objects (`sidechainAnalysis`, `kickAnalysis`, etc.) with strength bars, decay times — exactly as current.

### Core Sections (Global Telemetry, Instrumentation & Synthesis, Effects Chain, Arrangement, Secret Sauce)

- Layout unchanged.
- Content source depends on mode (Gemini vs Local).
- When `telemetry.elements` exists (Gemini mode), render sonic element breakdown cards in the Global Telemetry section.

---

## 9. Prompt Engineering

### New files in `services/gemini/prompts/`:

| File                  | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `phase1Analysis.ts`   | Phase 1 prompt — comprehensive audio analysis with local DSP hints |
| `phase2Refinement.ts` | Phase 2 prompt — refinement pass with audio + Phase 1 + local DSP  |

### Archived:

| File                                       | Replaced by           |
| ------------------------------------------ | --------------------- |
| `services/gemini/prompts/audioAnalysis.ts` | `phase1Analysis.ts`   |
| `services/gemini/prompts/deviceChains.ts`  | `phase2Refinement.ts` |

### Prompt Design Principles:

- Always include: "You are analyzing audio for an Ableton Live 12 producer. All device names, parameter names, and workflow suggestions must be specific to Ableton Live 12."
- Always include: "The user wants to understand the sonic character of each element and how to recreate it."
- Phase 1: include local DSP hints with instruction: "These are approximate measurements from a local DSP engine. Use them as starting points but trust your own analysis of the audio."
- Phase 2: include instruction: "Only override Phase 1 values if you are more than 50% confident the original value is incorrect. Document any corrections with your reasoning and confidence level."
- Both prompts specify the exact JSON schema expected in the response.
- Both prompts explicitly request groove analysis and chord progression.

---

## 10. `services/gemini/geminiProvider.ts` — Rewrite Specification

```
GeminiProvider.analyze(file: File)
  │
  ├─► [PARALLEL]
  │   ├─► uploadToFilesAPI(file) → fileUri
  │   └─► runBaseDSP(file) → LocalDSPHints + AudioBuffer
  │
  ├─► runPhase1(fileUri, hints) → GeminiPhase1Response
  │     Sends audio ref + hints prompt
  │     Validates with Zod (see Section 4e)
  │     1 retry on API error
  │
  ├─► runPhase2(fileUri, phase1, hints) → GeminiPhase2Response
  │     Sends audio ref (same URI) + Phase 1 + hints
  │     Validates with Zod
  │     1 retry on API error
  │
  ├─► assembleBlueprint(phase1, phase2, hints, audioBuffer)
  │     → ReconstructionBlueprint
  │     Merges all results
  │     Applies Phase 2 corrections (confidence > 0.5)
  │     Attaches local DSP waveform/spectral data
  │
  └─► deleteUploadedFile(fileUri) [fire-and-forget]
```

### Error Handling:

- Files API upload fails → fall back to inline base64 for Phase 1 only, skip Phase 2 audio
- Phase 1 fails after retry → **fall back to full Local mode** (run `LocalAnalysisProvider.analyze()`)
- Phase 2 fails after retry → use Phase 1 results only (still good)
- Base DSP fails → show error, cannot proceed (need AudioBuffer for waveform)

### Model Selection:

- Default: `gemini-2.5-flash`
- Override: user-selected model from UI dropdown or `VITE_GEMINI_MODEL` env var
- 7 models available (see Section 7)

---

## 11. `services/localProvider.ts` — NO CHANGES

The Local provider retains its FULL current pipeline. It is not modified in any way. It runs all 8 specialized detectors, genre classification, Mix Doctor, HPSS, chord detection, polyphonic pitch — everything it does today.

---

## 12. `services/chatService.ts` — Modification

- Strip Claude, OpenAI, and Ollama chat backends
- Keep Gemini chat backend only
- Chat context includes the full `ReconstructionBlueprint`
- **Local mode with Gemini API key:** chat works — analysis was local, but chat uses Gemini with the locally-generated blueprint as context
- **No Gemini API key at all:** chat is disabled with message "Chat requires a Gemini API key"

---

## 13. Files Modified — Complete List

| File                                          | Nature of Change                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `services/gemini/geminiProvider.ts`           | **Major rewrite** — new 2-phase pipeline with base DSP + Files API                                    |
| `services/gemini/prompts/phase1Analysis.ts`   | **New file** — Phase 1 prompt                                                                         |
| `services/gemini/prompts/phase2Refinement.ts` | **New file** — Phase 2 prompt                                                                         |
| `services/gemini/types/analysis.ts`           | **Rewrite** — new response schemas + Zod validation                                                   |
| `services/gemini/schemas/`                    | **New directory** — Zod schemas for Phase 1 and Phase 2 responses                                     |
| `types.ts`                                    | **Modify** — add new types, add optional fields (no removals)                                         |
| `App.tsx`                                     | **Modify** — 2-option provider selector, keep model selector, progress states, remove polyMode toggle |
| `components/BlueprintDisplay.tsx`             | **Modify** — conditional rendering for Gemini vs Local; Mix Doctor → Mix Feedback                     |
| `services/chatService.ts`                     | **Modify** — Gemini-only chat                                                                         |
| `.github/copilot-instructions.md`             | **Update** — reflect new architecture                                                                 |
| `CLAUDE.md`                                   | **Update** — reflect new architecture                                                                 |

### Files ARCHIVED to `archive/v1/`:

| File                                        | Archive Reason                   |
| ------------------------------------------- | -------------------------------- |
| `services/abletonParser.ts`                 | Confirmed drift                  |
| `services/discogsMaest.ts`                  | Replaced by Gemini               |
| `services/claudeProvider.ts`                | Provider consolidation           |
| `services/openaiProvider.ts`                | Provider consolidation           |
| `services/ollamaProvider.ts`                | Provider consolidation           |
| `services/ollamaClient.ts`                  | Provider consolidation           |
| `services/azureOpenAIProvider.ts`           | Provider consolidation           |
| `api/openai.ts`                             | Provider consolidation           |
| `api/azure-openai.ts`                       | Provider consolidation           |
| `api/claude.ts`                             | Chat consolidated to Gemini-only |
| `services/gemini/prompts/audioAnalysis.ts`  | Replaced by phase1Analysis.ts    |
| `services/gemini/prompts/deviceChains.ts`   | Replaced by phase2Refinement.ts  |
| `services/__tests__/claudeProvider.test.ts` | Tests archived provider          |
| `services/__tests__/ollamaClient.test.ts`   | Tests archived provider          |

### Test Files REWRITTEN:

| File                                      | Change                                                      |
| ----------------------------------------- | ----------------------------------------------------------- |
| `__tests__/App.providerFallback.test.tsx` | Rewrite to test Gemini→Local fallback (was Ollama fallback) |
| `__tests__/components/ChatPanel.test.tsx` | Rewrite to test Gemini-only chat (was Claude chat)          |

### New Test Files:

| File                                        | Purpose                                    |
| ------------------------------------------- | ------------------------------------------ |
| `services/__tests__/geminiProvider.test.ts` | Full pipeline tests with mocked Gemini API |
| `services/__tests__/geminiSchemas.test.ts`  | Zod schema validation edge cases           |

---

## 14. What This Plan Does NOT Change

- **`services/audioAnalysis.ts`** — untouched; powers spectral balance, heatmap, waveform in BOTH modes
- **`services/localProvider.ts`** — untouched; full-featured Local mode engine
- **All 8 specialized detectors** — untouched; continue to run in Local mode
- **`services/mixDoctor.ts`** — untouched; continues to run in Local mode
- **Session Musician** (YIN pitch detection → MIDI) — untouched
- **MIDI export/preview** — untouched
- **Patch Smith** (synth presets) — untouched
- **Waveform visualizer** — untouched (uses local AudioBuffer + spectral data)
- **Spectral Area Chart + Heatmap** — untouched (use `spectralTimeline` from `audioAnalysis.ts`)
- **Blueprint export** (JSON/text download) — untouched
- **Deployment setup** (Vercel, edge functions) — untouched
- **CSS/styling** — untouched
- **`services/stereoAnalysis.ts`** — untouched (imported by audioAnalysis.ts)
- **`services/loudness.ts`** — untouched (imported by audioAnalysis.ts)
- **`services/genreClassifier.ts`** — untouched (imported by localProvider.ts)
- **`@spotify/basic-pitch`** — stays in bundle (used by Local mode polyphonic pitch)

---

## 15. Verification Checklist (Post-Implementation)

### Build & CI

- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run lint` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes (including new + rewritten tests)

### UI

- [ ] Provider selector shows only "Gemini (recommended)" and "Local (offline)"
- [ ] Gemini model selector shows 7 models, defaults to `gemini-2.5-flash`
- [ ] Model selector visible only when Gemini is selected
- [ ] Polyphonic mode toggle removed from Session Musician

### Local Mode

- [ ] Full pipeline runs unchanged — all 8 detectors produce results
- [ ] Mix Feedback section renders numeric scores (from mixReport)
- [ ] Genre classification works
- [ ] Waveform + spectral heatmap + spectral area chart render correctly
- [ ] Session Musician works (YIN pitch → MIDI)
- [ ] Patch Smith works
- [ ] Blueprint export works
- [ ] Chat disabled if no Gemini API key; enabled if key exists

### Gemini Mode

- [ ] Base DSP pass runs + Files API upload in parallel
- [ ] Progress indicators update: Uploading → Decoding → Phase 1 → Phase 2 → Building
- [ ] Phase 1 returns and validates via Zod
- [ ] Phase 2 returns and validates via Zod
- [ ] Global Telemetry includes sonic elements breakdown from Gemini
- [ ] Detected characteristics render as descriptive cards
- [ ] Instrumentation, Effects Chain, Arrangement, Secret Sauce render Gemini content
- [ ] Mix Feedback section renders Gemini prose assessment
- [ ] Chord progression and groove info displayed
- [ ] Spectral visualizations (heatmap, area chart) work (from local DSP spectralTimeline)
- [ ] Waveform visualizer works (from local DSP audioBuffer)
- [ ] Session Musician works (same as Local)
- [ ] Patch Smith works (same as Local)
- [ ] Chat works with Gemini
- [ ] Blueprint export includes Gemini analysis

### Error Handling

- [ ] Phase 1 failure → falls back to full Local mode with UI warning
- [ ] Phase 2 failure → uses Phase 1 results only (no error shown to user)
- [ ] Files API upload failure → falls back to inline base64
- [ ] Malformed Gemini JSON → Zod fallbacks produce partial blueprint
- [ ] No API key + Gemini selected → graceful redirect to Local mode

### Archive

- [ ] `archive/v1/` directory exists with all 14 archived files
- [ ] No active imports reference archived files
- [ ] Archived test files removed from test runner

---

## 16. Execution Order

1. **Create `archive/v1/` directory** — move 14 files
2. **Types** — update `types.ts` with new interfaces (additive only)
3. **Zod schemas** — create `services/gemini/schemas/` with Phase 1 + Phase 2 validators
4. **New prompts** — create `phase1Analysis.ts` and `phase2Refinement.ts`
5. **New Gemini response types** — rewrite `services/gemini/types/analysis.ts`
6. **Rewrite `geminiProvider.ts`** — new 2-phase pipeline with base DSP + Files API
7. **Modify `App.tsx`** — 2-option provider selector, keep model selector, progress states
8. **Modify `BlueprintDisplay.tsx`** — conditional rendering, Mix Feedback
9. **Modify `chatService.ts`** — Gemini-only
10. **Remove stale imports** — clean up references to archived files throughout codebase
11. **Write new tests** — `geminiProvider.test.ts`, `geminiSchemas.test.ts`
12. **Rewrite tests** — `App.providerFallback.test.tsx`, `ChatPanel.test.tsx`
13. **Update docs** — `CLAUDE.md`, `.github/copilot-instructions.md`
14. **Run verification checklist**

---

## 17. Deferred Items (Post-V2)

| Item                                | Reason deferred                               |
| ----------------------------------- | --------------------------------------------- |
| IndexedDB result caching            | Quality-of-life; prove pipeline quality first |
| `@spotify/basic-pitch` lazy loading | Bundle size optimization; not blocking        |
| Gemini cost/rate limiting           | Proof of concept with personal credits        |
| Bundle size quantification          | Measure after implementation                  |
| Polyphonic MIDI mode                | UI toggle removed; code retained for future   |

---

## Appendix A: Glossary

- **Telemetry**: In this codebase, "telemetry" means "measured audio characteristics" — BPM, key, spectral bands, detector results. NOT analytics/tracking. It's the sonic measurement data about the uploaded track.
- **Blueprint**: The complete analysis output — `ReconstructionBlueprint` — containing all telemetry, arrangement, instrumentation, effects, and recommendations.
- **Base DSP Pass**: The audio feature extraction pipeline that runs in Gemini mode — full `extractAudioFeatures()` + HPSS + chords + Essentia, minus the 8 genre detectors and Mix Doctor. ~85-90% of full pipeline computation.
- **Secret Sauce**: A single standout production technique identified in the track, with instructions for recreation in Ableton Live 12.
- **Mix Feedback**: Assessment of the track's mix quality relative to genre norms. Powered by Gemini prose in Gemini mode; powered by numeric spectral comparison in Local mode.
- **HPSS**: Harmonic/Percussive Source Separation — splits audio into harmonic-only and percussive-only signals.
- **Session Musician**: The MIDI transcription feature — YIN pitch detection → MIDI notes for export.
- **Patch Smith**: Generates downloadable synth presets (Vital `.vitalpreset` and Ableton Operator configurations).
- **Files API**: Google's file upload API for Gemini — upload once, reference by URI in multiple API calls, delete when done.
