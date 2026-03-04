# Performance Baseline and Budget

Date: 2026-03-05

## Current build baseline

- Largest JS chunk (pre-refactor baseline): ~2.61 MB (`dist/assets/index-*.js`)
- Total JS emitted: tracked by budget script per build.

## Enforced budgets

- `BUNDLE_MAX_CHUNK_BYTES` default: `2_900_000`
- `BUNDLE_MAX_TOTAL_JS_BYTES` default: `6_000_000`

These are validated by `scripts/check-bundle-size.mjs` and enforced in CI via `pnpm run build:verify`.

## Notes

- `@google/genai` and DSP stack dependencies produce a large vendor/runtime footprint.
- The budget is intentionally set to current-safe thresholds to prevent regressions during the refactor; tighten after module-splitting and lazy-loading work completes.
