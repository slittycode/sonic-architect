<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sonic Architect — Ableton Live 12 Deconstructor

Upload any audio stem and get a full Ableton Live 12 reconstruction blueprint: BPM, key, arrangement, instrument racks, FX chains, and secret-sauce tips. Includes a **Session Musician** that transcribes audio to MIDI with a piano-roll editor.

## Features

- **Local DSP Engine** — BPM detection, key detection (Krumhansl-Schmuckler), spectral analysis, onset detection. Runs entirely in the browser, no API key needed.
- **Gemini Provider** (optional) — Cloud-based analysis via Gemini 1.5 Pro for richer blueprint results.
- **Session Musician** — YIN-based pitch detection → MIDI export. Piano roll visualisation, quantisation (1/4–1/32 + swing), Web Audio preview, `.mid` download.
- **Ableton Device Mapping** — Spectral characteristics mapped to real Ableton Live 12 devices (Operator, Wavetable, Drift, etc.).

## Quick Start

**Prerequisites:** [Node.js](https://nodejs.org/) (v18+) and [pnpm](https://pnpm.io/)

```bash
# 1. Clone the repo
git clone https://github.com/SocialSlitty/sonic-architect.git
cd sonic-architect

# 2. Install dependencies
pnpm install

# 3. Start the dev server
pnpm dev
```

Open **http://localhost:3000** in your browser, click **Import Stem**, and upload an audio file.

### Gemini API (optional)

The app works fully offline with the Local DSP engine. To enable cloud analysis via Gemini:

1. Create a `.env.local` file in the project root:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
2. Select **Gemini 1.5 Pro** from the engine selector in the top-right corner.

> The Vite config maps `GEMINI_API_KEY` → `import.meta.env.VITE_GEMINI_API_KEY`. You can also set `VITE_GEMINI_API_KEY` directly.

## Scripts

| Command                 | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| `pnpm dev`              | Start development server (Vite)                                      |
| `pnpm build`            | Production build to `dist/`                                          |
| `pnpm preview`          | Preview the production build locally                                 |
| `pnpm run typecheck`    | Run TypeScript checks                                                |
| `pnpm run lint`         | Run ESLint checks                                                    |
| `pnpm run format:check` | Verify Prettier formatting                                           |
| `pnpm run qa:static`    | Run deterministic static gates (`typecheck`, `lint`, `format:check`) |
| `pnpm run qa:test`      | Run deterministic Vitest suite                                       |
| `pnpm run qa:review`    | Run headless Codex review (local CLI/auth required)                  |
| `pnpm run qa:all`       | Run static + test gates                                              |

## Deterministic QA Workflow

Use this sequence for a full deterministic review/test pass:

```bash
# 1) Static gates
pnpm run qa:static

# 2) Automated tests
pnpm run qa:test

# 3) Optional: AI-assisted full code review
pnpm run qa:review
```

`qa:review` does not run in CI; it is a local review helper for severity-ranked findings.

### Browser smoke checks

Start the app and run Playwright smoke scripts against the same URL (defaults to `http://localhost:3000`):

```bash
# Terminal 1
pnpm dev

# Terminal 2
APP_URL=http://localhost:3000 python verification/verify_animation.py
APP_URL=http://localhost:3000 python verification/verify_shortcuts.py
```

Screenshots are written outside the repo by default to a temp directory. To override:

```bash
VERIFICATION_OUTPUT_DIR=/absolute/path/to/artifacts APP_URL=http://localhost:3000 python verification/verify_animation.py
```

These checks are deterministic UI sanity checks and do not call live Gemini/Claude APIs.

## Tech Stack

- **React 19** + **TypeScript 5.8** + **Vite 6**
- **Meyda** — audio feature extraction
- **midi-writer-js** — MIDI file generation
- **Web Audio API** — audio decoding, pitch detection, MIDI preview
- **Tailwind CSS** (CDN) — styling
- **Lucide React** — icons

## Global CLI Installation

Install `sonic` as a global command to launch from any directory:

```bash
# One-time installation
pnpm link --global

# Now you can run from anywhere
sonic
```

### How It Works

- The `sonic` command starts the Vite development server
- Automatically opens Google Chrome to `http://localhost:3000`
- Hot-reload is enabled - edit code and see changes instantly
- Press `Ctrl+C` in terminal to stop the server

### Updating After Code Changes

Since `sonic` runs the development server, **no rebuild is needed**:

1. Edit any file in the codebase
2. Run `sonic` from any terminal directory
3. Vite hot-reload applies changes automatically
4. Refresh browser if needed (usually auto-reloads)

### Uninstall

```bash
pnpm unlink --global
```
