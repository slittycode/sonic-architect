# Refactor Migration Notes

## Entry points

- `App.tsx` is now a compatibility shim.
- Main shell implementation moved to `src/app/AppShell.tsx`.

## App decomposition

- Header UI extracted to `src/app/components/AppHeader.tsx`.
- Playback/status UI extracted to `src/app/components/PlaybackPanel.tsx`.
- Controller hooks introduced:
  - `src/app/hooks/useProviderSettings.ts`
  - `src/app/hooks/usePlaybackController.ts`
  - `src/app/hooks/useAnalysisController.ts`

## Gemini provider decomposition

Legacy monolith:

- `services/gemini/geminiProvider.ts`

New modules:

- `services/providers/gemini/client.ts`
- `services/providers/gemini/files.ts`
- `services/providers/gemini/phases.ts`
- `services/providers/gemini/validation.ts`
- `services/providers/gemini/assembler.ts`
- `services/providers/gemini/chat.ts`
- `services/providers/gemini/provider.ts`

Compatibility:

- `services/gemini/geminiProvider.ts` now re-exports from the new modules.
- Existing imports from `services/gemini` remain valid.

## Type migration

Domain entry points added:

- `src/domain/providers/types.ts`
- `src/domain/audio/types.ts`
- `src/domain/blueprint/types.ts`

`types.ts` remains a transitional compatibility barrel until all imports are migrated.

## Test layout

- `test/` has been converged into `__tests__/`.
- New files:
  - `__tests__/App.basic.test.tsx`
  - `__tests__/components/BlueprintDisplay.smoke.test.tsx`

## Repo split tooling

- Path manifests:
  - `scripts/refactor/path-manifests/app-paths.txt`
  - `scripts/refactor/path-manifests/lab-paths.txt`
- Split script:
  - `scripts/refactor/split-repos.sh`
