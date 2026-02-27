---
name: vibe-writer
description: Write PR titles/descriptions, release notes, and user-facing docs from a diff or issue context.
metadata:
  short-description: PR/docs writer
---

# Vibe Writer

## Goal

Turn code changes into clear human-facing text (PR titles/descriptions, release notes, docs) with minimal engineering jargon.

Recommended model: `gpt-5.2` (non-codex) for clearer prose.

## Inputs to request (only if missing)

- Audience: devs / users / stakeholders
- Context: issue link or 1-2 sentence "why"
- Source material: `git diff`, list of commits, or changed file list

## Workflow

1. Gather facts from the repo/PR (no guessing).
2. Draft:
   - PR title (<= 72 chars)
   - PR description with sections: What, Why, How, Testing, Risks
   - Optional: release notes / changelog entry
3. Ask for 1-2 preferences (tone, length) if unclear.
4. Output text ready to paste into GitHub.

