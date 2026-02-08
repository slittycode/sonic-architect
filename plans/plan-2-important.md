# Plan 2 — Important (should fix)

**Scope:** Improve UX, DX, and robustness without changing product scope.

**Context:** Part of the [Sonic Architect repository review](../REVIEW_AND_IMPROVEMENTS.md). See also [Plan 1 — Critical](plan-1-critical.md), [Plan 3 — Suggestions](plan-3-suggestions.md), [Plan 4 — Recommendations](plan-4-recommendations.md).

---

## 1. Larger analyzer file size

- In [App.tsx](../App.tsx), increase `MAX_FILE_SIZE` from 10MB to a larger value (e.g. **50MB** or **100MB**). Use a named constant and keep the error message in sync: `(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`.
- Optional: make limit configurable via `VITE_MAX_UPLOAD_MB` in [vite.config.ts](../vite.config.ts) with a fallback (e.g. 50).

## 2. Env documentation

- Add `.env.example` with `GEMINI_API_KEY=` (and optionally `VITE_MAX_UPLOAD_MB=50`).
- In [README.md](../README.md), state to copy to `.env.local` and set the key (and mention the file size limit if configurable).

## 3. useEffect dependency fix

- In [App.tsx](../App.tsx), wrap `togglePlayback` in `useCallback` with appropriate deps (e.g. `audioRef`, `isPlaying`) so the keydown effect's dependency array is stable.

## 4. Error recovery UI

- In the error block in [App.tsx](../App.tsx), add "Dismiss" (clear error) and optionally "Try again" (re-run analysis on same file) or "Reset" (clear file + blueprint + error).

## 5. Waveform

- Either implement real waveform (Web Audio API decode + draw peaks in [WaveformVisualizer](../components/WaveformVisualizer.tsx)) or clearly label the current view as "Placeholder" so users and future agents know it's not real audio data.

## 6. Linting and formatting

- Add ESLint (React + TypeScript) and Prettier; add `lint` and `format` scripts; optionally pre-commit or CI step.
