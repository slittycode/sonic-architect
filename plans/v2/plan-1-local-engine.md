# Plan 1 — Local Audio Analysis Engine

**Priority:** Highest — this is the architectural foundation for everything else.  
**Goal:** Make Sonic Architect fully functional with zero API keys by building real client-side audio analysis.

---

## Why this matters

Right now the app is a Gemini API wrapper with a nice UI. The entire analysis — BPM, key, arrangement, instrumentation, FX chain, secret sauce — is outsourced to a single `generateContent` call. This has serious problems:

- **Cost barrier:** Users need a Gemini API key (billing required for Pro)
- **Unreliable output:** Gemini hallucinates instrument names, BPMs, and device settings. There's no ground truth to validate against.
- **No offline use:** Producers often work in studios without stable internet
- **Black box:** Users can't trust or verify the analysis
- **Fragile:** Any Gemini API change, rate limit, or outage breaks the entire app

Client-side DSP solves all of these. BPM detection, key detection, spectral analysis, and onset detection are well-solved problems with battle-tested libraries that run in the browser.

---

## Tasks

### 1.1 — Add Meyda or Essentia.js for audio feature extraction

**Libraries to evaluate:**

| Library                                              | Size        | Features                                       | Browser support           |
| ---------------------------------------------------- | ----------- | ---------------------------------------------- | ------------------------- |
| [Meyda](https://meyda.js.org)                        | ~15KB       | RMS, spectral centroid, MFCC, chroma, loudness | Excellent (Web Audio API) |
| [Essentia.js](https://mtg.github.io/essentia.js/)    | ~2MB WASM   | BPM, key, onset, pitch, full MIR suite         | Good (WASM)               |
| [aubiojs](https://github.com/nicholasgasior/aubiojs) | ~500KB WASM | BPM, pitch, onset                              | Good (WASM)               |

**Recommendation:** Use **Meyda** for real-time spectral features (lightweight, perfect for visualizer) and **Essentia.js** for heavy-lifting analysis (BPM, key detection). Essentia.js can be loaded lazily only when analysis is triggered.

**Implementation:**

```typescript
// services/audioAnalysis.ts
import Meyda from 'meyda';

export interface AudioFeatures {
  bpm: number;
  key: { root: string; scale: string; confidence: number };
  spectralCentroid: number[]; // per-frame
  rms: number[]; // per-frame (loudness envelope)
  onsets: number[]; // timestamps of transients
  chroma: number[][]; // 12-bin chroma per frame
  mfcc: number[][]; // timbre fingerprint per frame
  spectralRolloff: number[]; // brightness over time
  duration: number;
}
```

### 1.2 — Build BPM and key detection pipeline

**BPM detection** (Essentia.js `RhythmExtractor2013` or `PercivalBpmEstimator`):

- Decode audio via Web Audio API `decodeAudioData`
- Pass float32 PCM to Essentia WASM module
- Return BPM + confidence score
- Handle edge cases: variable tempo, half/double time

**Key detection** (Essentia.js `KeyExtractor`):

- Uses HPCP (Harmonic Pitch Class Profile) chroma features
- Returns root note + scale (major/minor) + confidence
- Map to standard notation (e.g., "F# Minor")

### 1.3 — Build arrangement segmentation

Use spectral analysis to detect structural sections:

- Compute RMS energy envelope (loudness over time)
- Detect onset density changes (sparse = breakdown, dense = drop)
- Use spectral centroid delta to find timbral transitions
- Apply simple change-point detection to segment into Intro/Verse/Chorus/Drop/Outro
- Label sections with time ranges

This replaces Gemini's hallucinated arrangement with objectively measurable structure.

### 1.4 — Build instrumentation analysis via spectral bands

Instead of asking an LLM to "name the instruments," analyze frequency band energy:

| Band       | Range       | Typical instrument            |
| ---------- | ----------- | ----------------------------- |
| Sub bass   | 20-80 Hz    | Sub bass, 808                 |
| Low bass   | 80-250 Hz   | Bass guitar, kick body        |
| Low mids   | 250-500 Hz  | Warmth, body                  |
| Mids       | 500-2000 Hz | Vocals, synth leads, guitars  |
| Upper mids | 2-5 kHz     | Presence, attack, snare crack |
| Highs      | 5-10 kHz    | Hi-hats, cymbals, air         |
| Brilliance | 10-20 kHz   | Shimmer, sibilance            |

For each band, report:

- Average energy level (dB)
- Peak energy and timestamp
- Suggested Ableton device from a static knowledge base (e.g., high sub energy + clean sine shape = "Operator: sine osc, low-pass at 80Hz")

### 1.5 — Create Ableton device knowledge base

Build a static mapping from spectral characteristics to Ableton Live 12 device recommendations:

```typescript
// data/abletonDevices.ts
export const DEVICE_MAP = {
  subBass: {
    clean: {
      device: 'Operator',
      preset: 'Sine Sub',
      settings: 'Osc A: Sine, Filter: LP 24dB @ 80Hz',
    },
    distorted: {
      device: 'Wavetable',
      preset: 'Analog Sub',
      settings: 'Osc: Basic Shapes > Square, Drive: 30%',
    },
    reese: {
      device: 'Wavetable',
      preset: 'Reese Bass',
      settings: '2 Osc slightly detuned, Unison: 4 voices',
    },
  },
  // ... mapped by frequency band + timbral quality
};
```

This is deterministic and correct — no hallucination possible.

### 1.6 — FX chain detection from audio characteristics

Detect processing artifacts from spectral analysis:

- **Reverb:** RT60 estimate from impulse response analysis (onset tail decay)
- **Compression:** Crest factor (peak-to-RMS ratio) — low crest = heavy compression
- **Saturation/Distortion:** Harmonic content analysis (odd harmonics = clipping, even = tube warmth)
- **Delay:** Cross-correlation to detect echo patterns
- **Stereo width:** Mid/Side analysis (if stereo input)

Map each detected artifact to an Ableton FX recommendation from the knowledge base.

### 1.7 — Create `AnalysisProvider` abstraction

Decouple the UI from any specific analysis backend:

```typescript
// services/analysisProvider.ts
export interface AnalysisProvider {
  name: string;
  analyze(audioBuffer: AudioBuffer): Promise<ReconstructionBlueprint>;
  isAvailable(): Promise<boolean>;
}

export class LocalAnalysisProvider implements AnalysisProvider {
  name = 'Local DSP Engine';
  // Uses Meyda + Essentia.js — always available
}

export class OllamaProvider implements AnalysisProvider {
  name = 'Ollama (Local LLM)';
  // Uses local analysis + Ollama for interpretive text — Plan 2
}

export class GeminiProvider implements AnalysisProvider {
  name = 'Gemini 1.5 Pro (Cloud)';
  // Current behavior — kept as opt-in for users with API keys
}
```

The UI calls `provider.analyze()` and gets a `ReconstructionBlueprint` regardless of backend. Users can select their preferred provider in settings.

### 1.8 — Update `ReconstructionBlueprint` type

Add confidence scores and source metadata:

```typescript
export interface ReconstructionBlueprint {
  telemetry: GlobalTelemetry & { bpmConfidence: number; keyConfidence: number };
  arrangement: ArrangementSection[];
  instrumentation: InstrumentRackElement[];
  fxChain: FXChainItem[];
  secretSauce: SecretSauce;
  meta: {
    provider: string; // "local" | "ollama" | "gemini"
    analysisTime: number; // ms
    sampleRate: number;
    duration: number;
    channels: number;
  };
}
```

---

## Dependencies to add

```json
{
  "meyda": "^5.4.0",
  "essentia.js": "^0.1.3"
}
```

Essentia.js WASM file should be loaded lazily via dynamic import to keep initial bundle small.

---

## What changes in the UI

- The "Neural Engine Analyzing Spectrogram..." message becomes accurate — it's actually analyzing the spectrogram now
- BPM and key show confidence scores (e.g., "128 BPM (98% confidence)")
- The waveform visualizer uses real audio data (feeds into Plan 3)
- A small settings gear lets users pick their analysis provider
- The app works immediately on first load — no API key prompt, no env file, no billing setup
- The footer updates from "Gemini 1.5 Pro" to the active provider name

---

## What stays the same

- The entire UI layout and design
- The `BlueprintDisplay` component (same props shape, extended with optional fields)
- File upload flow
- Playback controls

---

## Risk assessment

| Risk                                         | Mitigation                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Essentia.js WASM is ~2MB                     | Lazy load only on analysis trigger; show progress bar                                          |
| BPM detection can give half/double time      | Show top 3 candidates; let user override                                                       |
| Key detection less accurate on complex mixes | Show confidence; allow manual override                                                         |
| No "secret sauce" without LLM                | Use template: "Dominant technique: [detected artifact]. Try [Ableton device] with [settings]." |
| Arrangement segmentation imprecise           | Show energy curve visualization so users can see the segmentation logic                        |
