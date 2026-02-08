# Plan 4 — Recommendations (implementation order)

**Scope:** Suggested order to execute the work across Critical, Important, and Suggestions.

**Context:** Part of the [Sonic Architect repository review](../REVIEW_AND_IMPROVEMENTS.md). See also [Plan 1 — Critical](plan-1-critical.md), [Plan 2 — Important](plan-2-important.md), [Plan 3 — Suggestions](plan-3-suggestions.md).

---

## Execution order

1. **Increase analyzer file size** (Plan 2) — single constant change in [App.tsx](../App.tsx).
2. **API key check and message** (Plan 1).
3. **Blueprint validation** in geminiService (Plan 1).
4. **.env.example + README** (Plan 2).
5. **Vitest + RTL and first tests** (Plan 1).
6. **ESLint + Prettier** (Plan 2).
7. **useCallback for togglePlayback** (Plan 2).
8. **Error recovery UI** (Plan 2).
9. **Waveform: real or placeholder label** (Plan 2).
10. **Blueprint export** (Plan 3).
11. **Tailwind via build** (Plan 3).
12. **Remaining suggestions** (Plan 3) as needed.
