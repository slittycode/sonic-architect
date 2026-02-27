# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Dev server at http://localhost:3000
pnpm build            # Production build to dist/
pnpm test             # Run all tests (vitest run)
pnpm run typecheck    # TypeScript check (tsc --noEmit)
pnpm run lint         # ESLint
pnpm run format:check # Prettier check
pnpm run qa:static    # Typecheck + lint + format check
pnpm run qa:all       # Typecheck + lint + format check + tests
```

Run a single test file:
```bash
pnpm vitest run services/__tests__/bpmDetection.test.ts
```

Run tests matching a name pattern:
```bash
pnpm vitest run -t "detects BPM"
```

## Architecture

Sonic Architect is a React SPA that analyzes audio files and generates Ableton Live 12 reconstruction blueprints. Deployed on Vercel; the frontend is a standard Vite SPA and `api/*.ts` files are Vercel Edge Functions.

### Provider Pattern

All analysis engines implement `AnalysisProvider` from `types.ts`. Five providers exist:

- **`services/localProvider.ts`** — Client-side DSP via Web Audio API + Meyda. Always available, no API key. This is the core engine.
- **`services/geminiService.ts`** — Runs local DSP first, then enriches via Gemini.
- **`services/claudeProvider.ts`** — Runs local DSP first, then enriches via `api/claude.ts` proxy.
- **`services/ollamaProvider.ts`** — Runs local DSP first, then enriches via local Ollama.
- **`services/openaiProvider.ts`** — Runs local DSP first, then enriches via `api/openai.ts` proxy.

**Critical invariant**: Cloud providers only enhance descriptive text. Measured values (BPM, key, spectral bands) from the local DSP are never overwritten by LLM output — only the `bpmCorrectedByGemini` / `keyCorrectedByGemini` flags on `GlobalTelemetry` represent intentional overrides.

### DSP Pipeline

`services/audioAnalysis.ts` decodes audio and extracts base features. The full pipeline in `localProvider.ts` runs these stages (mostly in parallel):

1. `audioAnalysis.ts` — spectral bands, BPM, key, RMS, onsets
2. `essentiaFeatures.ts` — Essentia.js WASM features (dissonance, HFC, spectral complexity, ZCR)
3. `hpss.ts` — Harmonic/Percussive Source Separation for cleaner chord analysis
4. `chordDetection.ts` — Chord progressions on the harmonic-only signal
5. `bpmDetection.ts` / `keyDetection.ts` — Autocorrelation BPM, Krumhansl-Schmuckler key
6. `polyphonicPitch.ts` — Basic Pitch WASM for polyphonic note detection (used by supersaw analysis)
7. `pitchDetection.ts` — YIN-based monophonic pitch (Session Musician / audio→MIDI)
8. `genreClassifierEnhanced.ts` — Orchestrates 8 specialized detectors via `Promise.all()`:
   - `sidechainDetection.ts`, `bassAnalysis.ts`, `acidDetection.ts`, `reverbAnalysis.ts`
   - `kickAnalysis.ts`, `vocalDetection.ts`, `supersawDetection.ts`
   - Swing detection (in `bassAnalysis.ts`)

All specialized detector results are typed in `GlobalTelemetry` (`types.ts`) as optional sub-objects (e.g. `sidechainAnalysis`, `kickAnalysis`).

### API Proxies

`api/claude.ts` and `api/openai.ts` are Vercel Edge Functions. In local dev, `vite.config.ts` includes a `claudeDevProxy` plugin that loads the Claude handler via Vite SSR — so `pnpm dev` works without `vercel dev`. `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are server-side only.

### Data Layer

`data/abletonDevices.ts` — deterministic spectral-to-device mapping (no LLM).
`data/genreProfiles.ts` — target spectral profiles used by the Mix Doctor feature.

### Feature Services

Beyond the DSP pipeline, these services handle secondary features:

- `chatService.ts` — powers the chat panel for Q&A about the analyzed track
- `midiExport.ts` / `midiPreview.ts` — MIDI file generation and in-browser preview
- `patchSmith.ts` — generates Vital/Operator patch download links
- `exportBlueprint.ts` — JSON/text export of the reconstruction blueprint
- `quantization.ts` — beat quantization utilities
- `mixDoctor.ts` — spectral balance comparison against genre reference profiles

## Key Conventions

- **Path alias**: `@/*` maps to project root. Use `@/types` not `../types`.
- **Tailwind CSS v4**: Loaded via `@tailwindcss/vite` plugin, not PostCSS. `index.css` contains only `@import 'tailwindcss'`.
- **Test locations**: Two directories — `__tests__/` (component and integration tests) and `services/__tests__/` (service unit tests). Both are picked up by vitest.
- **Test environment**: jsdom with `vitest.setup.ts` providing browser API mocks (ResizeObserver, Canvas, localStorage, HTMLMediaElement). In test mode, `VITE_GEMINI_API_KEY` is injected as empty string so tests never hit real APIs.
- **State management**: `useState`/`useCallback` in `App.tsx` only. No external state library.
- **Component structure**: Flat — all components in `components/`, all services in `services/`.
- **Formatting**: Prettier — single quotes, trailing commas (`es5`), 100-char print width, 2-space indent.
- **`bin/sonic.js`**: CLI entry point registered as `sonic` binary.
