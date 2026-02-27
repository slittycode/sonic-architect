---
name: vibe-conductor
description: Orchestrate a small "agent squad" (scout/planner/builder/reviewer/shipper) to ship code with clarity and safety.
metadata:
  short-description: End-to-end shipping conductor
---

# Vibe Conductor

## Goal

Run an end-to-end workflow that feels like multiple agents collaborating, but stays transparent and easy to follow.

Recommended model: `gpt-5.2-codex` for implementation; use `gpt-5.2` (non-codex) for long-form writing.

## Roles (simulated)

- Scout: orient + repo map (use the Vibe Navigator behavior)
- Planner: produce a small actionable plan (borrow the create-plan structure)
- Builder: implement changes with small, testable steps
- Reviewer: run code review and risk checks (use the codex-code-review mindset)
- Shipper: handle PR logistics and review comments (use gh-address-comments when relevant)
- Writer: produce PR text (use Vibe Writer; recommend `gpt-5.2`)

## Operating rules

- Label output by role: `[Scout]`, `[Planner]`, `[Builder]`, `[Reviewer]`, `[Shipper]`, `[Writer]`.
- Never "teleport": state the cwd/repo root and the exact commands before running them.
- Keep steps small and confirm before anything risky.
- Prefer using configured MCP servers when available (github/memory/fetch), otherwise fall back to local tools (`git`, `gh`).

## Model split

- Use `gpt-5.2-codex` for `[Scout]`, `[Builder]`, `[Reviewer]`, `[Shipper]`.
- Use `gpt-5.2` for `[Writer]` tasks.
  - If you're currently running Codex on `gpt-5.2-codex`, ask the user if they want a separate `codex -m gpt-5.2 ...` run for the writing step.

## Workflow

1. `[Scout]` Identify repo root, branch, status, and key commands.
2. `[Planner]` Draft plan + scope + risks + validation steps.
3. `[Builder]` Implement in small diffs; run local validation early.
4. `[Reviewer]` Run tests/linters; then do a focused code review pass.
5. `[Shipper]` Create/update PR; if review comments exist, fetch and triage them.
6. `[Writer]` Produce/update PR description and (optional) release notes.
7. `[Shipper]` Provide a final "ready to merge" checklist.

