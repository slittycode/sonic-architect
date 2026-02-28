---
name: "playwright-cli"
description: "CLI-first browser automation for real browser workflows. Use when the task involves navigating websites, filling forms, taking screenshots, extracting data, verifying UI elements, debugging web flows, or running browser smoke checks. Also use when the user mentions Playwright, browser testing, visual verification, accessibility checks, or wants to interact with a running dev server. Applies to both localhost and external sites."
---

# Playwright CLI

Drive a real browser from the terminal using `playwright-cli` via the bundled wrapper script. This is CLI-first automation — do not pivot to `@playwright/test` specs unless the user explicitly asks.

## Setup

Resolve the wrapper script path from the project root:

```bash
PWCLI="$(git rev-parse --show-toplevel)/skills/playwright/scripts/playwright_cli.sh"
chmod +x "$PWCLI"
```

The wrapper uses `npx --package @playwright/cli playwright-cli` so no global install is needed. Verify `npx` is available:

```bash
command -v npx >/dev/null 2>&1 || echo "npx not found — install Node.js first"
```

## Core workflow

1. Open the page.
2. Snapshot to get stable element refs.
3. Interact using refs from the latest snapshot.
4. Re-snapshot after navigation or DOM changes.
5. Capture artifacts (screenshot, PDF, traces) when useful.

```bash
"$PWCLI" open https://example.com
"$PWCLI" snapshot
"$PWCLI" click e3
"$PWCLI" snapshot
```

## When to re-snapshot

Snapshot again after:
1. Navigation or page reload
2. Clicking elements that change the UI (modals, menus, tabs)
3. Form submissions that redirect
4. Any command that fails with a stale ref

Refs go stale when the DOM changes. When a command fails with a missing ref, snapshot and retry — don't guess at new ref numbers.

## Common patterns

### Form fill and submit

```bash
"$PWCLI" open https://example.com/form
"$PWCLI" snapshot
"$PWCLI" fill e1 "user@example.com"
"$PWCLI" fill e2 "password123"
"$PWCLI" click e3           # submit button
"$PWCLI" snapshot            # verify result
"$PWCLI" screenshot
```

### Data extraction

```bash
"$PWCLI" open https://example.com
"$PWCLI" snapshot
"$PWCLI" eval "document.title"
"$PWCLI" eval "el => el.textContent" e12
```

### Debug with traces

```bash
"$PWCLI" open https://example.com --headed
"$PWCLI" tracing-start
# ... reproduce the issue ...
"$PWCLI" tracing-stop
"$PWCLI" screenshot
```

### Multi-tab

```bash
"$PWCLI" tab-new https://example.com
"$PWCLI" tab-list
"$PWCLI" tab-select 0
"$PWCLI" snapshot
```

## Sonic Architect verification

These patterns verify the local dev server at `http://localhost:3000`. Start the server first with `pnpm dev`.

### App loads correctly

```bash
"$PWCLI" open http://localhost:3000 --headed
"$PWCLI" snapshot
# Verify "Sonic Architect" heading is visible
"$PWCLI" eval "document.querySelector('h1')?.textContent"
"$PWCLI" screenshot
```

### Keyboard shortcuts

```bash
"$PWCLI" open http://localhost:3000
"$PWCLI" snapshot
# Check the play button has aria-keyshortcuts="Space"
"$PWCLI" eval "document.querySelector('[aria-keyshortcuts]')?.getAttribute('aria-keyshortcuts')"
# Check title contains "Space"
"$PWCLI" eval "document.querySelector('[aria-keyshortcuts]')?.getAttribute('title')"
```

### Component presence check

```bash
"$PWCLI" open http://localhost:3000
"$PWCLI" snapshot
# Check that key sections exist
"$PWCLI" eval "Array.from(document.querySelectorAll('section')).map(s => s.getAttribute('aria-label')).filter(Boolean)"
```

### After audio upload (requires a test audio file)

```bash
"$PWCLI" open http://localhost:3000 --headed
"$PWCLI" snapshot
"$PWCLI" upload ./test-audio.wav    # upload via file input
"$PWCLI" snapshot                   # UI should show analysis in progress
# Wait for analysis to complete, then snapshot again
"$PWCLI" screenshot
```

## Artifact output

When capturing screenshots or traces in this project, save to `output/playwright/` to keep artifacts contained:

```bash
mkdir -p output/playwright
```

## References

Open only what you need:
1. **CLI command reference** — `references/cli.md` (all commands and flags)
2. **Workflows and troubleshooting** — `references/workflows.md` (sessions, config, debugging)

## Guardrails

1. Always snapshot before referencing element IDs like `e12`.
2. Re-snapshot when refs seem stale — never guess at ref numbers.
3. Prefer explicit CLI commands over `eval` / `run-code` unless DOM inspection is needed.
4. Use `--headed` when a visual check helps debug.
5. Default to CLI commands, not Playwright test specs.
6. When saving artifacts in this repo, use `output/playwright/` — don't create new top-level folders.
