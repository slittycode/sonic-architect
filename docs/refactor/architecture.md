# Refactored App Architecture

## High-level layout

- `src/app/`: composition shell and app-level controllers.
- `src/domain/`: typed domain entry points for provider/audio/blueprint concerns.
- `services/providers/gemini/`: Gemini provider pipeline modules.
- `services/gemini/`: compatibility API surface and Gemini schemas/prompts.

## Control flow

1. `App.tsx` forwards to `src/app/AppShell.tsx`.
2. `AppShell` coordinates:
   - provider preferences (`useProviderSettings`),
   - playback state (`usePlaybackController`),
   - upload validation (`useAnalysisController`),
   - analysis orchestration and UI state.
3. Gemini analysis path executes via `GeminiProvider` from `services/providers/gemini/provider.ts`.

## Compatibility strategy

- Keep existing import surfaces stable (`services/gemini`, `types.ts`) while introducing new modular paths.
- Migrate call sites incrementally to `src/domain/*` and `services/providers/*`.
