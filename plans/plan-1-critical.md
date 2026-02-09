# Plan 1 — Critical (must fix)

**Scope:** Address correctness, security, and reliability so the app doesn't fail in unclear ways.

**Context:** Part of the [Sonic Architect repository review](../REVIEW_AND_IMPROVEMENTS.md). See also [Plan 2 — Important](plan-2-important.md), [Plan 3 — Suggestions](plan-3-suggestions.md), [Plan 4 — Recommendations](plan-4-recommendations.md).

---

## 1. API key check

- In [services/geminiService.ts](../services/geminiService.ts) (or in App before calling `analyzeAudio`), check `import.meta.env.VITE_GEMINI_API_KEY` and throw a clear error if missing (e.g. "Missing API key. Set GEMINI_API_KEY in .env.local.").
- Optionally in [App.tsx](../App.tsx) show a one-time banner when key is missing so users don't hit the error only after uploading.

## 2. Blueprint validation

- After `JSON.parse` in [services/geminiService.ts](../services/geminiService.ts), validate that the object has required keys: `telemetry`, `arrangement`, `instrumentation`, `fxChain`, `secretSauce` (and that `telemetry` has `bpm`, `key`, `groove`; `secretSauce` has `trick`, `execution`).
- If invalid, throw a clear error (e.g. "Invalid analysis result; please try again.") so the UI doesn't crash when rendering [BlueprintDisplay](../components/BlueprintDisplay.tsx).

## 3. Minimal test suite

- Add Vitest + React Testing Library.
- Tests: (1) geminiService — parsing valid JSON into blueprint and throwing on invalid/missing key; (2) App — file size/type validation and error state; (3) BlueprintDisplay — renders with a fixture blueprint without crashing.
