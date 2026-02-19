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

Open **http://localhost:5173** in your browser, click **Import Stem**, and upload an audio file.

### Gemini API (optional)

The app works fully offline with the Local DSP engine. To enable cloud analysis via Gemini:

1. Create a `.env.local` file in the project root:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
2. Select **Gemini 1.5 Pro** from the engine selector in the top-right corner.

> The Vite config maps `GEMINI_API_KEY` → `import.meta.env.VITE_GEMINI_API_KEY`. You can also set `VITE_GEMINI_API_KEY` directly.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (Vite) |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview the production build locally |

## Deployment

- One-click deploy on Vercel: [vercel.com/new](https://vercel.com/new)
- `GEMINI_API_KEY` is optional. Local analysis works without it.
- This app is a static SPA, so no server is required.
- Build command: `npm run build`
- Output directory: `dist`

## Tech Stack

- **React 19** + **TypeScript 5.8** + **Vite 6**
- **Meyda** — audio feature extraction
- **midi-writer-js** — MIDI file generation
- **Web Audio API** — audio decoding, pitch detection, MIDI preview
- **Tailwind CSS** (CDN) — styling
- **Lucide React** — icons
