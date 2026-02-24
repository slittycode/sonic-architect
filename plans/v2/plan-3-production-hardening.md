# Plan 3 — Production Hardening

**Priority:** Medium — can be executed in parallel with Plans 1 and 2.  
**Goal:** Fix real bugs, ship real features, clean up the build pipeline. This absorbs the useful parts of v1 plans while discarding items that become irrelevant after Plans 1-2.

---

## What's kept from v1 plans (and why)

| v1 item                  | Status                  | Reasoning                                                                                   |
| ------------------------ | ----------------------- | ------------------------------------------------------------------------------------------- |
| API key check            | **Dropped**             | Plan 1 removes the hard Gemini dependency. Provider selection handles this generically.     |
| Blueprint validation     | **Kept (modified)**     | Still needed — local analysis and LLM both produce JSON that needs validation.              |
| Test suite               | **Kept (expanded)**     | More important now with multiple providers to test.                                         |
| File size limit increase | **Kept**                | Still relevant for local analysis.                                                          |
| Env documentation        | **Dropped**             | No env vars needed for default (local) mode. Ollama/Gemini docs go in provider settings UI. |
| useEffect dependency fix | **Kept**                | Real bug, easy fix.                                                                         |
| Error recovery UI        | **Kept**                | Still needed.                                                                               |
| Real waveform            | **Kept (critical now)** | Plan 1 decodes real audio — the waveform visualizer must use it.                            |
| ESLint + Prettier        | **Kept**                | Standard DX.                                                                                |
| Tailwind via build       | **Kept**                | CDN script tag is fragile.                                                                  |
| Blueprint export         | **Kept (expanded)**     | Now exports the richer local analysis data.                                                 |
| Import map cleanup       | **Kept**                | Dead code should go.                                                                        |
| Loading state            | **Kept**                | Prevent double uploads.                                                                     |

---

## Tasks

### 3.1 — Real waveform visualization

Replace the random-data D3 bars with actual audio waveform peaks. This is tightly coupled with Plan 1's audio decoding.

```typescript
// In WaveformVisualizer.tsx
// 1. Receive decoded AudioBuffer (from Plan 1) instead of just audioUrl
// 2. Extract peak data from the buffer's channel data
// 3. Draw actual waveform using D3

function extractPeaks(buffer: AudioBuffer, numBars: number): number[] {
  const data = buffer.getChannelData(0); // mono or left channel
  const blockSize = Math.floor(data.length / numBars);
  const peaks: number[] = [];
  for (let i = 0; i < numBars; i++) {
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const abs = Math.abs(data[i * blockSize + j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }
  return peaks;
}
```

Also add:

- Playback position indicator (vertical line that tracks `<audio>` currentTime)
- Click-to-seek on the waveform
- Zoom in/out on waveform (scroll wheel)

### 3.2 — Blueprint validation with Zod

Replace the unsafe `as ReconstructionBlueprint` cast with proper runtime validation:

```typescript
import { z } from 'zod';

const BlueprintSchema = z.object({
  telemetry: z.object({
    bpm: z.string(),
    key: z.string(),
    groove: z.string(),
    bpmConfidence: z.number().optional(),
    keyConfidence: z.number().optional(),
  }),
  arrangement: z.array(
    z.object({
      timeRange: z.string(),
      label: z.string(),
      description: z.string(),
    })
  ),
  instrumentation: z.array(
    z.object({
      element: z.string(),
      timbre: z.string(),
      frequency: z.string(),
      abletonDevice: z.string(),
    })
  ),
  fxChain: z.array(
    z.object({
      artifact: z.string(),
      recommendation: z.string(),
    })
  ),
  secretSauce: z.object({
    trick: z.string(),
    execution: z.string(),
  }),
  meta: z
    .object({
      provider: z.string(),
      analysisTime: z.number(),
      sampleRate: z.number(),
      duration: z.number(),
      channels: z.number(),
    })
    .optional(),
});

export function validateBlueprint(data: unknown): ReconstructionBlueprint {
  return BlueprintSchema.parse(data);
}
```

### 3.3 — Test suite (Vitest + React Testing Library)

**Setup:**

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Test targets:**

| Test file                               | What it covers                                             |
| --------------------------------------- | ---------------------------------------------------------- |
| `__tests__/audioAnalysis.test.ts`       | BPM detection accuracy with known test files               |
| `__tests__/blueprintValidation.test.ts` | Zod schema: valid/invalid/partial input                    |
| `__tests__/providers.test.ts`           | Provider fallback chain, Ollama availability check         |
| `__tests__/App.test.tsx`                | File upload validation, error states, status transitions   |
| `__tests__/BlueprintDisplay.test.tsx`   | Renders fixture blueprint, handles missing optional fields |
| `__tests__/WaveformVisualizer.test.tsx` | Renders with/without audio data, peak extraction           |

### 3.4 — Fix useEffect dependency (togglePlayback)

Wrap in `useCallback`:

```typescript
const togglePlayback = useCallback(() => {
  if (audioRef.current) {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }
}, [isPlaying]);
```

Or better — use a ref for the latest callback to avoid re-subscribing the keydown listener entirely:

```typescript
const togglePlaybackRef = useRef(togglePlayback);
togglePlaybackRef.current = togglePlayback;

useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'Space') {
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, button, a, [role="button"]')) return;
      event.preventDefault();
      if (audioUrl) togglePlaybackRef.current();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [audioUrl]);
```

### 3.5 — Error recovery UI

Add dismiss/retry/reset actions to the error block in App.tsx:

```tsx
{
  error && (
    <div className="mt-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
      <div className="flex items-center gap-3 text-red-200">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <span className="text-sm flex-1">{error}</span>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setError(null)}
          className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700"
        >
          Dismiss
        </button>
        {lastFile && (
          <button
            onClick={() => triggerAnalysis(lastFile)}
            className="text-xs px-3 py-1.5 bg-blue-800 text-blue-200 rounded hover:bg-blue-700"
          >
            Retry Analysis
          </button>
        )}
        <button
          onClick={resetAll}
          className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700"
        >
          Start Over
        </button>
      </div>
    </div>
  );
}
```

### 3.6 — Blueprint export

Add a download button when a blueprint is present:

- **JSON export**: Download the raw `ReconstructionBlueprint` as a `.json` file
- **Markdown report**: Generate a human-readable markdown report from the blueprint
- **ALS template** (stretch): Generate an Ableton Live Set XML skeleton with tracks and devices pre-configured from the blueprint (this is complex but extremely high-value)

### 3.7 — Build pipeline cleanup

**Tailwind via Vite:**

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

Update `vite.config.ts` to use the Tailwind plugin, remove the CDN `<script>` from `index.html`.

**Remove dead import map:**

The esm.sh import map in `index.html` is unused when running via Vite (Vite bundles everything). Remove it. If it's needed for AI Studio hosting, add a comment explaining that and conditionally include it.

**ESLint + Prettier:**

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks prettier
```

Add `eslint.config.js` (flat config) and `.prettierrc`. Add scripts:

```json
{
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

### 3.8 — Loading state improvements

- Disable "Import Stem" button during `ANALYZING` state
- Show determinate progress if possible (local analysis can report stages)
- Prevent drag-and-drop or paste of files during analysis
- Add cancel analysis capability (AbortController for fetch/LLM calls)

### 3.9 — Increase file size limit

Change `MAX_FILE_SIZE` from 10MB to 100MB (local analysis can handle larger files since there's no upload to a remote API). Add a warning at 50MB+ that analysis may take longer:

```typescript
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50MB - show warning
```

---

## Implementation order within this plan

1. **3.4** useEffect fix (5 min, prevents bugs)
2. **3.9** File size limit (2 min, constant change)
3. **3.7** Build pipeline (Tailwind + import map + ESLint) — do early so all new code passes lint
4. **3.2** Blueprint validation (Zod schema)
5. **3.1** Real waveform (depends on Plan 1 audio decoding)
6. **3.5** Error recovery UI
7. **3.3** Test suite
8. **3.6** Blueprint export
9. **3.8** Loading state improvements
