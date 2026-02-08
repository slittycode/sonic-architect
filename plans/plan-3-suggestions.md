# Plan 3 — Suggestions (nice to have)

**Scope:** Lower priority improvements that improve polish and maintainability.

**Context:** Part of the [Sonic Architect repository review](../REVIEW_AND_IMPROVEMENTS.md). See also [Plan 1 — Critical](plan-1-critical.md), [Plan 2 — Important](plan-2-important.md), [Plan 4 — Recommendations](plan-4-recommendations.md).

---

## 1. import map

- Document in README or a short comment in [index.html](../index.html) when the esm.sh import map is used (e.g. AI Studio) vs Vite bundle, or remove it if unused.

## 2. Tailwind via build

- Install `tailwindcss` and PostCSS and move from CDN in [index.html](../index.html) to Vite-built CSS for smaller, consistent builds.

## 3. Blueprint export

- Add a "Download blueprint" (JSON) and optionally a "Download report" (readable) in [BlueprintDisplay](../components/BlueprintDisplay.tsx) or App when a blueprint is present.

## 4. Loading state

- Disable "Import Stem" (or show spinner) while analysis is in progress to avoid double uploads.

## 5. Verification

- In README or [verification/README.md](../verification/README.md), add how to run Playwright scripts: e.g. `npm run dev`, then `python verification/verify_shortcuts.py`.

## 6. Footer

- Update "© 2024" when shipping; consider moving "Reference Model: Gemini 1.5 Pro" to an "About" or dev-only section.
