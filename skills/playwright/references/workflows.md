# Playwright CLI Workflows

Snapshot often. Assume `PWCLI` is set to the wrapper script path.

## Standard interaction loop

```bash
"$PWCLI" open https://example.com
"$PWCLI" snapshot
"$PWCLI" click e3
"$PWCLI" snapshot
```

## Form submission

```bash
"$PWCLI" open https://example.com/form --headed
"$PWCLI" snapshot
"$PWCLI" fill e1 "user@example.com"
"$PWCLI" fill e2 "password123"
"$PWCLI" click e3
"$PWCLI" snapshot
"$PWCLI" screenshot
```

## Data extraction

```bash
"$PWCLI" open https://example.com
"$PWCLI" snapshot
"$PWCLI" eval "document.title"
"$PWCLI" eval "el => el.textContent" e12
```

## Debugging and inspection

Capture console messages and network activity:

```bash
"$PWCLI" console warning
"$PWCLI" network
```

Record a trace around a suspicious flow:

```bash
"$PWCLI" tracing-start
# reproduce the issue
"$PWCLI" tracing-stop
"$PWCLI" screenshot
```

## Sessions

Isolate work across different contexts:

```bash
"$PWCLI" --session marketing open https://example.com
"$PWCLI" --session marketing snapshot
"$PWCLI" --session checkout open https://example.com/checkout
```

Or set the session once:

```bash
export PLAYWRIGHT_CLI_SESSION=checkout
"$PWCLI" open https://example.com/checkout
```

## Configuration file

The CLI reads `playwright-cli.json` from the current directory by default. Use `--config` to point at a specific file.

Minimal example:

```json
{
  "browser": {
    "launchOptions": {
      "headless": false
    },
    "contextOptions": {
      "viewport": { "width": 1280, "height": 720 }
    }
  }
}
```

## Sonic Architect — Smoke checks

These workflows verify the Sonic Architect dev server. Start with `pnpm dev` first.

### Verify app loads

```bash
"$PWCLI" open http://localhost:3000
"$PWCLI" snapshot
"$PWCLI" eval "document.querySelector('h1')?.textContent"
# Expected: "Sonic Architect"
"$PWCLI" screenshot
```

### Verify keyboard shortcuts

The play button should have `aria-keyshortcuts="Space"`:

```bash
"$PWCLI" open http://localhost:3000
"$PWCLI" snapshot
"$PWCLI" eval "document.querySelector('[aria-keyshortcuts]')?.getAttribute('aria-keyshortcuts')"
# Expected: "Space"
"$PWCLI" eval "document.querySelector('[aria-keyshortcuts]')?.title"
# Expected: contains "Space"
```

### Verify section structure

```bash
"$PWCLI" open http://localhost:3000
"$PWCLI" snapshot
"$PWCLI" eval "Array.from(document.querySelectorAll('section')).map(s => s.getAttribute('aria-label')).filter(Boolean)"
```

### Test file upload flow

```bash
"$PWCLI" open http://localhost:3000 --headed
"$PWCLI" snapshot
"$PWCLI" upload ./path/to/test-audio.wav
"$PWCLI" snapshot
# Wait for analysis, then check results
"$PWCLI" eval "document.querySelector('[data-testid=\"bpm\"]')?.textContent"
"$PWCLI" screenshot
```

### Visual regression

Take a baseline screenshot, then compare after changes:

```bash
mkdir -p output/playwright/baselines
"$PWCLI" open http://localhost:3000
"$PWCLI" screenshot    # save as baseline
# After code changes, repeat and compare
```

## Troubleshooting

1. **Stale ref** — Run `"$PWCLI" snapshot` again and retry with the new ref.
2. **Page looks wrong** — Re-open with `--headed` and resize: `"$PWCLI" resize 1280 720`.
3. **State-dependent flow** — Use a named `--session` to preserve cookies and storage.
4. **Dev server not running** — Start `pnpm dev` in a separate terminal first.
5. **npx not found** — Install Node.js (which includes npm/npx).
