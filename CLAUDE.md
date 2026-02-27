# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Dev server at http://localhost:3000
pnpm build            # Production build to dist/
pnpm test             # Run all tests (vitest run)
pnpm run typecheck    # TypeScript check (tsc --noEmit)
pnpm run lint         # ESLint
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

All analysis engines implement `AnalysisProvider` from `types.ts`. Four providers exist:

- **`services/localProvider.ts`** — Client-side DSP via Web Audio API + Meyda. Always available, no API key. This is the core engine.
- **`services/geminiService.ts`** — Runs local DSP first, then enriches via Gemini.
- **`services/claudeProvider.ts`** — Runs local DSP first, then enriches via `api/claude.ts` proxy.
- **`services/ollamaProvider.ts`** — Runs local DSP first, then enriches via local Ollama.

**Critical invariant**: Cloud providers only enhance descriptive text. Measured values (BPM, key, spectral bands) from the local DSP are never overwritten by LLM output — only the `bpmCorrectedByGemini` / `keyCorrectedByGemini` flags on `GlobalTelemetry` represent intentional overrides.

### DSP Pipeline

`services/audioAnalysis.ts` decodes audio and extracts features. Supporting modules:
- `bpmDetection.ts` — Autocorrelation-based BPM detection
- `keyDetection.ts` — Krumhansl-Schmuckler key detection
- `chordDetection.ts` — Chord progression analysis
- `pitchDetection.ts` — YIN-based pitch detection (Session Musician / audio→MIDI)

### Claude API Proxy

`api/claude.ts` is a Vercel Edge Function. In local dev, `vite.config.ts` includes `claudeDevProxy` which loads this same handler via Vite SSR — so `pnpm dev` works without `vercel dev`. `ANTHROPIC_API_KEY` is server-side only.

### Data Layer

`data/abletonDevices.ts` — deterministic spectral-to-device mapping (no LLM).
`data/genreProfiles.ts` — target spectral profiles used by the Mix Doctor feature.

## Key Conventions

- **Path alias**: `@/*` maps to project root. Use `@/types` not `../types`.
- **Tailwind CSS v4**: Loaded via `@tailwindcss/vite` plugin, not PostCSS. `index.css` contains only `@import 'tailwindcss'`.
- **Test locations**: Two directories — `__tests__/` (component and integration tests) and `services/__tests__/` (service unit tests). Both are picked up by vitest.
- **Test environment**: jsdom with `vitest.setup.ts` providing browser API mocks (ResizeObserver, Canvas, localStorage, HTMLMediaElement). In test mode, `VITE_GEMINI_API_KEY` is injected as empty string so tests never hit real APIs.
- **State management**: `useState`/`useCallback` in `App.tsx` only. No external state library.
- **Component structure**: Flat — all components in `components/`, all services in `services/`.
- **Formatting**: Prettier — single quotes, trailing commas (`es5`), 100-char print width, 2-space indent.
- **`bin/sonic.js`**: CLI entry point registered as `sonic` binary.
