# Sonic Architect — Copilot Instructions

## Build, Test, and Lint

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server on http://localhost:3000
pnpm build                # Production build to dist/
pnpm run typecheck        # TypeScript check (tsc --noEmit)
pnpm run lint             # ESLint
pnpm run format:check     # Prettier check
pnpm run qa:static        # Typecheck + lint + format check
pnpm run qa:all           # Static checks + tests
pnpm test                 # Run all tests (vitest run)
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

Sonic Architect is a React SPA that analyzes audio files and generates Ableton Live 12 reconstruction blueprints. It runs in the browser with optional cloud enrichment.

### Provider Pattern

All analysis engines implement the `AnalysisProvider` interface from `types.ts`:

- **`services/localProvider.ts`** — Client-side DSP using Web Audio API and Meyda. Always available, no API key. This is the core engine; all other providers build on its output.
- **`services/geminiService.ts`** — Runs local DSP first, then sends the blueprint + raw audio to Gemini for enrichment.
- **`services/claudeProvider.ts`** — Runs local DSP first, then enriches via the Claude API proxy.
- **`services/ollamaProvider.ts`** — Runs local DSP first, then enriches via a local Ollama instance.

Cloud providers follow the same pattern: run `LocalAnalysisProvider` for deterministic measurements (BPM, key, spectral bands), then call the LLM to enhance descriptive text only. Measured values are never overwritten by the LLM.

### Claude API Proxy

`api/claude.ts` is a Vercel Edge Function that proxies requests to the Anthropic API. In local dev, `vite.config.ts` includes a `claudeDevProxy` plugin that loads this same handler via Vite SSR, so `pnpm dev` works without `vercel dev`.

### DSP Pipeline

`services/audioAnalysis.ts` decodes audio and extracts features (BPM, key, spectral bands, RMS profile, onsets). Supporting modules:

- `bpmDetection.ts` — Autocorrelation-based BPM detection
- `keyDetection.ts` — Krumhansl-Schmuckler key detection
- `chordDetection.ts` — Chord progression analysis
- `pitchDetection.ts` — YIN-based pitch detection for Session Musician (audio→MIDI)

### Data Layer

`data/abletonDevices.ts` maps spectral characteristics to Ableton device recommendations (deterministic, no LLM). `data/genreProfiles.ts` defines target spectral profiles for the Mix Doctor feature.

### Deployment

Deployed on Vercel. `vercel.json` configures `api/*.ts` files as edge functions. The frontend is a standard Vite SPA build.

## Key Conventions

- **Path alias**: `@/*` maps to the project root (configured in `tsconfig.json` and `vite.config.ts`). Use `@/types` instead of `../types`.
- **Tailwind CSS v4**: Loaded via `@tailwindcss/vite` plugin, not PostCSS. `index.css` contains only `@import 'tailwindcss'`.
- **Test locations**: Tests live in two directories — `__tests__/` (component and integration tests) and `test/` (unit tests mirroring `services/`, `components/`). Service unit tests are at `services/__tests__/`.
- **Test environment**: jsdom with `vitest.setup.ts` providing browser API mocks (ResizeObserver, Canvas, localStorage, HTMLMediaElement).
- **API keys**: `GEMINI_API_KEY` in `.env.local` is mapped to `import.meta.env.VITE_GEMINI_API_KEY` by `vite.config.ts`. In test mode, it's injected as empty string so tests never hit real APIs. `ANTHROPIC_API_KEY` is used server-side only (edge function).
- **Formatting**: Prettier with single quotes, trailing commas (`es5`), 100-char print width, 2-space indent.
- **Component structure**: Flat — all components in `components/`, all services in `services/`. No nested feature directories.
- **State management**: React useState/useCallback in `App.tsx`. No external state library.
