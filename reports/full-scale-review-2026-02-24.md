# Full-Scale Code Review Report (2026-02-24)

## Scope

- Hybrid review:
- Working-tree changes first (`App.tsx`, `components/ChatPanel.tsx`, chat/api/test/CI/docs updates)
- Full repository scan for correctness, security, performance, and maintainability
- Deterministic validation only (no live Gemini/Claude network integration tests)

## Validation Executed

- `pnpm run qa:all`
- `pnpm run qa:review`
- `uv run --with playwright python verification/verify_animation.py`
- `uv run --with playwright python verification/verify_shortcuts.py`

## Required Before Merge

- None open.

### Required issues that were found and fixed in this pass

1. `P1` Chat stream decode mismatch in UI

- Repro: Send a chat message and receive streamed text chunks.
- Impact: `TextDecoder.decode` was called with string chunks, which can throw at runtime.
- Files: `components/ChatPanel.tsx`
- Fix: Consume stream chunks as strings directly and remove `TextDecoder` usage.

2. `P1` API proxy risk with server-side key fallback

- Repro: Deploy with `ANTHROPIC_API_KEY` on server and call `/api/claude` without user key.
- Impact: Endpoint could be used as an unauthenticated proxy to Anthropic billing.
- Files: `api/claude.ts`, `api/__tests__/claude.test.ts`
- Fix: Require `x-api-key` header for all POST requests and remove env-key fallback behavior.

3. `P2` Chat UI/service state divergence on blueprint changes

- Repro: Build chat history, then switch blueprint context.
- Impact: Visible messages could diverge from the recreated service history.
- Files: `components/ChatPanel.tsx`, `__tests__/components/ChatPanel.test.tsx`
- Fix: Reset visible chat/error state whenever blueprint context recreates the chat service.

4. `P3` Smoke scripts reported success even on failure

- Repro: Cause script exception; process still exits `0`.
- Impact: False positives in local/CI smoke verification.
- Files: `verification/verify_animation.py`, `verification/verify_shortcuts.py`
- Fix: Re-raise exceptions in `except` blocks.

## Follow-up Debt

1. `P3` Optional future DSP architecture enhancement

- Repro: analyze long/high-sample-rate audio files on low-power devices.
- Current: code-path hotspots were optimized in this pass (frame capping/stride in `keyDetection`, linear segmentation in `pitchDetection`).
- Recommendation: move heavy DSP into Web Workers only if UI thread contention is still observed in production profiling.

## Exit Gate Status

- CI pipeline definition aligned to `pnpm`:
  - `typecheck`, `lint`, `format:check`, `test` on Node 20/22 (`.github/workflows/ci.yml`)
- Deterministic tests:
  - `23` test files passed
  - `91` tests passed
- Browser smoke checks:
  - Passed against canonical local URL (`http://localhost:3000`)
- Residual risks:
  - No open lint warnings from this review pass.

## Completion Note (Plan Execution)

- Lint cleanup: complete (`pnpm run lint` with zero warnings/errors).
- DSP refactor: complete (`services/keyDetection.ts` and `services/pitchDetection.ts` optimized without workers).
- Screenshot policy migration: complete (verification scripts now write to external artifacts via `VERIFICATION_OUTPUT_DIR` or temp dir default, and repo-tracked screenshots removed).
