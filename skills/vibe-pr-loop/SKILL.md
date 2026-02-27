---
name: vibe-pr-loop
description: Tight loop for addressing GitHub PR review comments (fetch, triage, fix, re-review, update).
metadata:
  short-description: PR comment triage + fix loop
---

# Vibe PR Loop

## Goal

Turn PR feedback into an ordered todo list, fix the selected items, and verify with tests/review.

Recommended model: `gpt-5.2-codex`.

## Workflow

1. Verify `gh` auth and that the current branch has an open PR.
2. Fetch PR comments/threads (use `gh-address-comments`, especially `scripts/fetch_comments.py`).
3. Number threads, summarize each in 1-2 lines, and ask which ones to address now.
4. Apply fixes for selected items:
   - State which files will change (before editing)
   - Run targeted tests/commands after changes
5. Run a quick code review pass on changed files.
6. Provide a suggested reply to reviewers summarizing what changed and how to verify it.

