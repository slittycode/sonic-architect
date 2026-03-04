# Refactor Baseline

Date: 2026-03-05
Branch: codex/full-scale-refactor
Workspace: /Users/christiansmith/code/projects/sonic-architect

## Baseline status

- `pnpm run typecheck`: pass
- `pnpm test`: pass (36 files, 219 tests)
- `pnpm run build`: pass with chunk-size warnings and dynamic/static import warnings
- `pnpm run lint`: fails due mixed repo scope (non-product directories) and core precision lint issue in `services/loudness.ts`

## Known failures to eliminate

- Lint scope bleed into `skills/`, `archive/`, and non-product Node/browser mixed scripts.
- `no-loss-of-precision` errors in `services/loudness.ts`.

## Initial objectives

1. Harden lint/TS/CI boundaries to app code.
2. Decompose monoliths (`App.tsx`, `types.ts`, `services/gemini/geminiProvider.ts`).
3. Normalize test structure and remove duplicate paths.
4. Add bundle budget checks and performance baseline report.
