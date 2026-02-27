# Spectral Toggle, PLR Dynamics, Chord Layout & Markdown Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move chord progression to full-width, fix markdown rendering for `1)` numbered lists, add proportional/absolute toggle to the spectral area chart, and replace the broken crest-factor dynamics metric with PLR (Peak-to-Loudness Ratio).

**Architecture:** All changes are UI/component or service-level — no new files needed. The PLR computation happens in `audioAnalysis.ts` after the existing `measureLoudness()` call; the value flows through `AudioFeatures` → `mixDoctor.ts` → `MixDoctorReport` → `MixDoctorPanel`. The spectral toggle is local state in `BlueprintDisplay` (now a stateful component), passed as a prop to `SpectralAreaChart`. The markdown renderer is rewritten inline — no npm dependency.

**Tech Stack:** TypeScript, React (hooks), D3 v7, Tailwind CSS v4, Vitest

---

### Task 1: Move Chord Progression to Full-Width Block

**Files:**
- Modify: `components/BlueprintDisplay.tsx`

The chord panel currently lives inside the left column of the 3-column grid (lines 174–237). It needs to be its own full-width section between the spectral panels and the Mix Doctor panel.

**Step 1: Remove chord panel from the left column**

Delete lines 174–237 in `BlueprintDisplay.tsx` (the entire `{/* Chord Progression */}` block, from `{blueprint.chordProgression &&` through the closing `)}` at the end of the left column).

The left column should end at line 173 with `</div>` closing the Timeline panel, then `</div>` closing the whole left column div.

**Step 2: Add full-width chord panel after the spectral section**

In `BlueprintDisplay.tsx`, after the closing `</div>` of the spectral section block (currently line 480, after `{/_ Spectral Timeline Visualization _/}`), insert the full-width chord panel before `{/_ Mix Doctor Dashboard _/}`:

```tsx
{/* Chord Progression — Full Width */}
{blueprint.chordProgression && blueprint.chordProgression.length > 0 && (
  <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-700">
    <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
      <Music className="w-4 h-4 text-amber-400" aria-hidden="true" />
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
        Chord Progression
      </h3>
      {blueprint.chordProgressionSummary && (
        <span className="ml-auto text-xs text-amber-400/70 font-mono">
          {blueprint.chordProgressionSummary}
        </span>
      )}
    </div>
    <div className="p-4">
      {(() => {
        const chords = blueprint.chordProgression;
        const totalStart = parseSegTime(chords[0].timeRange, 'start');
        const totalEnd = parseSegTime(chords[chords.length - 1].timeRange, 'end');
        const totalDuration = Math.max(1, totalEnd - totalStart);
        return (
          <div className="overflow-x-auto">
            <div
              className="flex gap-px"
              style={{ minWidth: `${Math.max(800, chords.length * 60)}px` }}
            >
              {chords.map((seg, idx) => {
                const s = parseSegTime(seg.timeRange, 'start');
                const e = parseSegTime(seg.timeRange, 'end');
                const pct = Math.max(4, ((e - s) / totalDuration) * 100);
                const hue = (rootNoteIndex(seg.root) * 30) % 360;
                return (
                  <div
                    key={idx}
                    style={{ flex: `${pct} 0 0%` }}
                    className="flex flex-col items-center py-2 px-1 bg-zinc-950 border border-zinc-800/50 rounded-sm hover:bg-zinc-800 transition-colors cursor-default"
                    title={`${seg.chord} · ${seg.timeRange} · ${Math.round(seg.confidence * 100)}% conf`}
                  >
                    <span
                      className="text-xs font-bold mono"
                      style={{ color: `hsl(${hue},60%,65%)` }}
                    >
                      {seg.chord}
                    </span>
                    <span className="text-[8px] text-zinc-600 mt-0.5 mono">
                      {seg.timeRange.split('–')[0]}
                    </span>
                    <div
                      className="w-full mt-1 h-px rounded-full"
                      style={{ background: `hsl(${hue},50%,40%)`, opacity: seg.confidence }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  </div>
)}
```

**Step 3: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 4: Commit**

```bash
git add components/BlueprintDisplay.tsx
git commit -m "feat: move chord progression to full-width panel below spectral displays"
```

---

### Task 2: Fix Markdown Renderer — `1)` Format and Multi-Paragraph Items

**Files:**
- Modify: `components/BlueprintDisplay.tsx` (lines 40–68, the `renderMarkdown` function)

**Problem:** `renderMarkdown` splits on `\n\n` then checks if *every* line in a block matches the numbered pattern. LLMs output `1)` (parenthesis) not `1.`, and each numbered item often appears as its own `\n\n`-separated block, so `lines.every()` passes for single-line items but consecutive numbered blocks don't merge into one `<ol>`.

**Step 1: Replace renderMarkdown with two-pass grouping version**

Replace lines 40–68 entirely:

```typescript
function renderMarkdown(text: string): React.ReactNode {
  // Pass 1: split into paragraph blocks
  const blocks = text.split(/\n{2,}/);

  // Pass 2: group consecutive numbered/bulleted blocks into lists
  type Group =
    | { type: 'ol'; items: string[] }
    | { type: 'ul'; items: string[] }
    | { type: 'p'; content: string };

  const groups: Group[] = [];
  for (const block of blocks) {
    const firstLine = block.split('\n')[0].trim();
    const isNumbered = /^\d+[.)]\s/.test(firstLine);
    const isBullet = /^[-*]\s/.test(firstLine);

    if (isNumbered) {
      const last = groups[groups.length - 1];
      // Strip the leading number prefix from each line, join continuation lines
      const content = block.replace(/^\d+[.)]\s*/, '').replace(/\n/g, ' ');
      if (last?.type === 'ol') {
        last.items.push(content);
      } else {
        groups.push({ type: 'ol', items: [content] });
      }
    } else if (isBullet) {
      const last = groups[groups.length - 1];
      const content = block.replace(/^[-*]\s*/, '').replace(/\n/g, ' ');
      if (last?.type === 'ul') {
        last.items.push(content);
      } else {
        groups.push({ type: 'ul', items: [content] });
      }
    } else {
      groups.push({ type: 'p', content: block.replace(/\n/g, ' ') });
    }
  }

  // Render groups
  return groups.map((g, gi) => {
    if (g.type === 'ol') {
      return (
        <ol key={gi} className="list-decimal list-inside space-y-2 text-sm text-indigo-200/80">
          {g.items.map((item, ii) => (
            <li key={ii} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
    }
    if (g.type === 'ul') {
      return (
        <ul key={gi} className="list-disc list-inside space-y-2 text-sm text-indigo-200/80">
          {g.items.map((item, ii) => (
            <li key={ii} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={gi} className="text-sm text-indigo-200/80 leading-relaxed">
        {renderInline(g.content)}
      </p>
    );
  });
}
```

**Step 2: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 3: Commit**

```bash
git add components/BlueprintDisplay.tsx
git commit -m "fix: rewrite markdown renderer to handle 1) format and multi-paragraph list items"
```

---

### Task 3: Add Proportional/Absolute Toggle to Spectral Area Chart

**Files:**
- Modify: `components/SpectralAreaChart.tsx`
- Modify: `components/BlueprintDisplay.tsx`

**Step 1: Add `mode` prop to SpectralAreaChart**

In `SpectralAreaChart.tsx`, update the props interface and the data normalization logic:

```typescript
// Change the props interface (currently line 12-16):
interface SpectralAreaChartProps {
  timeline: SpectralTimeline;
  arrangement: ArrangementSection[];
  duration: number;
  mode?: 'proportional' | 'absolute';  // add this
}
```

Then in the `useEffect`, replace the data-building loop (currently lines 67–84) to branch on mode:

```typescript
const SpectralAreaChart: React.FC<SpectralAreaChartProps> = ({
  timeline,
  arrangement,
  duration,
  mode = 'proportional',  // default: existing behaviour
}) => {
```

In the data loop, replace the normalization block:
```typescript
// Build tabular data: array of objects { time, "Sub Bass": val, ... }
const data: Record<string, number>[] = [];
for (let p = 0; p < numPoints; p++) {
  const row: Record<string, number> = { time: timeline.timePoints[p] };
  let totalPower = 0;
  const powers: number[] = [];
  for (const band of timeline.bands) {
    const power = band.energyDb[p] > -100 ? Math.pow(10, band.energyDb[p] / 10) : 0;
    powers.push(power);
    totalPower += power;
  }
  for (let b = 0; b < timeline.bands.length; b++) {
    row[timeline.bands[b].name] =
      mode === 'proportional' && totalPower > 0
        ? (powers[b] / totalPower) * 100
        : powers[b];
  }
  data.push(row);
}
```

Update Y-axis label format to reflect mode:
```typescript
// Replace Y axis tickFormat (currently `.tickFormat((d) => `${Math.round(d as number)}%`)`)
.tickFormat((d) =>
  mode === 'proportional'
    ? `${Math.round(d as number)}%`
    : (d as number).toExponential(1)
)
```

**Step 2: Add toggle state and button in BlueprintDisplay**

`BlueprintDisplay` is currently a pure functional component with no state. Convert it to use `useState` for the spectral mode toggle, with localStorage persistence:

At the top of `BlueprintDisplay.tsx`, add `useState` to the React import:
```typescript
import React, { useState } from 'react';
```

Inside `BlueprintDisplay` component body (just after `const BlueprintDisplay: React.FC<...> = ({ blueprint }) => {`), add:
```typescript
const [spectralMode, setSpectralMode] = useState<'proportional' | 'absolute'>(() => {
  try {
    return (localStorage.getItem('sonic-spectral-mode') as 'proportional' | 'absolute') ?? 'proportional';
  } catch {
    return 'proportional';
  }
});

const toggleSpectralMode = () => {
  const next = spectralMode === 'proportional' ? 'absolute' : 'proportional';
  setSpectralMode(next);
  try { localStorage.setItem('sonic-spectral-mode', next); } catch {}
};
```

In the "Spectral Balance Over Time" panel header, add toggle button alongside the title:
```tsx
<div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
  <Activity className="w-4 h-4 text-violet-400" aria-hidden="true" />
  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
    Spectral Balance Over Time
  </h3>
  <div className="ml-auto flex gap-1">
    {(['proportional', 'absolute'] as const).map((m) => (
      <button
        key={m}
        onClick={toggleSpectralMode}
        className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
          spectralMode === m
            ? 'bg-violet-600/20 border-violet-500 text-violet-400'
            : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
        }`}
      >
        {m === 'proportional' ? '%' : 'abs'}
      </button>
    ))}
  </div>
</div>
```

Pass `mode` to `SpectralAreaChart`:
```tsx
<SpectralAreaChart
  timeline={blueprint.spectralTimeline}
  arrangement={blueprint.arrangement}
  duration={blueprint.meta?.duration ?? 0}
  mode={spectralMode}
/>
```

**Step 3: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 4: Commit**

```bash
git add components/SpectralAreaChart.tsx components/BlueprintDisplay.tsx
git commit -m "feat: add proportional/absolute toggle to spectral area chart, persisted to localStorage"
```

---

### Task 4: Add PLR to Types

**Files:**
- Modify: `types.ts`

PLR (Peak-to-Loudness Ratio) = TruePeak(dBTP) − LUFS_integrated. Higher = more dynamic (uncompressed). Lower = more compressed.

**Step 1: Add `plr` to AudioFeatures and `targetPlrRange` to GenreProfile**

In `types.ts`:

After `crestFactor: number;` (line 111), add:
```typescript
/** Peak-to-Loudness Ratio in dB (TruePeak − LUFS). Higher = more dynamic. Set when lufsIntegrated and truePeak are available. */
plr?: number;
```

After `targetCrestFactorRange: [number, number];` (line 207), add:
```typescript
/** Expected PLR range in dB (TruePeak − LUFS_integrated). Replaces crest factor for compression assessment. */
targetPlrRange?: [number, number];
```

In `MixDoctorReport.dynamicsAdvice`, add `actualPlr`:
```typescript
dynamicsAdvice: {
  issue: 'too-compressed' | 'too-dynamic' | 'optimal';
  message: string;
  actualCrest: number;
  actualPlr?: number;   // add this
};
```

**Step 2: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add plr to AudioFeatures and targetPlrRange to GenreProfile types"
```

---

### Task 5: Compute PLR in audioAnalysis.ts

**Files:**
- Modify: `services/audioAnalysis.ts`

**Step 1: Compute PLR after measureLoudness**

In `audioAnalysis.ts`, after the `measureLoudness` call (currently around line 319):

```typescript
// --- LUFS loudness measurement ---
const loudness = measureLoudness(audioBuffer);

// --- PLR (Peak-to-Loudness Ratio) ---
const plr: number | undefined =
  loudness.lufsIntegrated != null && loudness.truePeak != null
    ? Math.round((loudness.truePeak - loudness.lufsIntegrated) * 10) / 10
    : undefined;
```

Add `plr` to the returned object (after `crestFactor`):
```typescript
return {
  bpm,
  bpmConfidence,
  key,
  spectralCentroidMean: Math.round(spectralCentroidMean),
  rmsMean,
  rmsProfile,
  spectralBands,
  crestFactor: Math.round(crestFactor * 10) / 10,
  plr,                     // add this
  onsetCount,
  // ... rest unchanged
};
```

**Step 2: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 3: Commit**

```bash
git add services/audioAnalysis.ts
git commit -m "feat: compute PLR (Peak-to-Loudness Ratio) in audioAnalysis"
```

---

### Task 6: Add targetPlrRange to Genre Profiles

**Files:**
- Modify: `data/genreProfiles.ts`

PLR values are calibrated from real commercial releases:
- Heavily compressed club music (Techno): PLR 5–9 dB
- Standard electronic/dance (EDM, House, Garage): PLR 6–10 dB
- Punchy with dynamics (Hip Hop, Pop, DnB): PLR 7–11 dB
- Rock/Metal (drums, transient-heavy): PLR 9–14 dB
- Acoustic/Indie (light/no limiting): PLR 13–20 dB
- Ambient/Downtempo (wide dynamics): PLR 12–20 dB

**Step 1: Add targetPlrRange to each genre in GENRE_PROFILES**

```typescript
// edm
targetPlrRange: [6, 10],

// hiphop
targetPlrRange: [7, 11],

// rock
targetPlrRange: [9, 14],

// pop
targetPlrRange: [7, 11],

// acoustic
targetPlrRange: [13, 20],

// techno
targetPlrRange: [5, 9],

// house
targetPlrRange: [6, 10],

// ambient
targetPlrRange: [12, 20],

// dnb
targetPlrRange: [7, 11],

// garage
targetPlrRange: [6, 10],
```

Add each `targetPlrRange` field immediately after `targetCrestFactorRange` in each profile object.

**Step 2: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 3: Commit**

```bash
git add data/genreProfiles.ts
git commit -m "feat: add targetPlrRange to all genre profiles"
```

---

### Task 7: Use PLR in Mix Doctor Scoring

**Files:**
- Modify: `services/mixDoctor.ts`

**Step 1: Replace crest factor dynamics logic with PLR-primary scoring**

In `mixDoctor.ts`, replace the entire "Evaluate dynamics (Crest Factor)" block (lines 110–129) with:

```typescript
// Evaluate dynamics: PLR-primary with crest factor fallback
let dynamicsIssue: 'too-compressed' | 'too-dynamic' | 'optimal' = 'optimal';
let dynamicsMsg = 'Solid dynamic range. Fits the genre well.';
let dynamicsPenalty = 0;

const crest = features.crestFactor;
const plr = features.plr;

// Use PLR when available (more accurate than raw crest factor)
if (plr != null && profile.targetPlrRange) {
  const [minPlr, maxPlr] = profile.targetPlrRange;
  if (plr < minPlr) {
    dynamicsIssue = 'too-compressed';
    dynamicsMsg = `PLR of ${plr} dB is below the ${minPlr}–${maxPlr} dB target for ${profile.name}. The mix is over-compressed — ease off the master limiter or reduce bus compression to recover transient punch.`;
    dynamicsPenalty = Math.min(15, (minPlr - plr) * 2.5);
  } else if (plr > maxPlr) {
    dynamicsIssue = 'too-dynamic';
    dynamicsMsg = `PLR of ${plr} dB exceeds the ${minPlr}–${maxPlr} dB target for ${profile.name}. Wide dynamic range — add bus compression or saturation to glue the mix.`;
    dynamicsPenalty = Math.min(15, (plr - maxPlr) * 2.5);
  }
} else {
  // Fallback: crest factor
  const [minCrest, maxCrest] = profile.targetCrestFactorRange;
  if (crest < minCrest) {
    dynamicsIssue = 'too-compressed';
    dynamicsMsg = 'Too compressed/squashed. The mix lacks transient punch. Ease off the master limiter or bus compressors.';
    dynamicsPenalty = Math.min(15, (minCrest - crest) * 2.5);
  } else if (crest > maxCrest) {
    dynamicsIssue = 'too-dynamic';
    dynamicsMsg = 'Too dynamic. Transients are jumping out too much. Add bus compression or saturation to glue the mix.';
    dynamicsPenalty = Math.min(15, (crest - maxCrest) * 2.5);
  }
}
```

Update the `dynamicsAdvice` object in the return statement to include `actualPlr`:

```typescript
dynamicsAdvice: {
  issue: dynamicsIssue,
  message: dynamicsMsg,
  actualCrest: Math.round(crest * 10) / 10,
  actualPlr: plr != null ? Math.round(plr * 10) / 10 : undefined,
},
```

**Step 2: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 3: Run mix doctor tests**

```bash
pnpm vitest run services/__tests__/mixDoctor.test.ts
```
Expected: all pass (tests use crest factor fixtures; PLR path is optional)

**Step 4: Commit**

```bash
git add services/mixDoctor.ts
git commit -m "feat: use PLR as primary dynamics metric in Mix Doctor, crest factor as fallback"
```

---

### Task 8: Update MixDoctorPanel to Show PLR and Crest Factor

**Files:**
- Modify: `components/MixDoctorPanel.tsx`

**Step 1: Update the DiagnosticCard for dynamics**

The existing dynamics block (currently lines 253–259) passes `actualCrest` to `DiagnosticCard`. Update it to show both metrics:

Replace:
```tsx
<DiagnosticCard
  accentColor="bg-blue-500"
  label="Dynamics (Crest Factor)"
  value={`${report.dynamicsAdvice.actualCrest} dB`}
>
  {report.dynamicsAdvice.message}
</DiagnosticCard>
```

With:
```tsx
<DiagnosticCard
  accentColor="bg-blue-500"
  label="Dynamics & Headroom"
  value={
    report.dynamicsAdvice.actualPlr != null
      ? `PLR ${report.dynamicsAdvice.actualPlr} dB`
      : `CF ${report.dynamicsAdvice.actualCrest} dB`
  }
>
  {report.dynamicsAdvice.message}
  {report.dynamicsAdvice.actualPlr != null && (
    <span className="block mt-1 text-[10px] text-zinc-600">
      Crest factor: {report.dynamicsAdvice.actualCrest} dB · PLR: {report.dynamicsAdvice.actualPlr} dB
    </span>
  )}
</DiagnosticCard>
```

**Step 2: Verify typecheck**

```bash
pnpm run typecheck
```
Expected: no errors

**Step 3: Run all tests**

```bash
pnpm vitest run
```
Expected: all pass

**Step 4: Commit**

```bash
git add components/MixDoctorPanel.tsx
git commit -m "feat: show PLR and crest factor together under Dynamics & Headroom in Mix Doctor"
```

---

## Verification

After all tasks complete:

```bash
pnpm run typecheck   # zero errors
pnpm vitest run      # all pass
pnpm dev             # manual check:
```

Manual checks:
1. Chord progression appears as a full-width panel **after** the spectral visualizations, before Mix Doctor
2. Secret Sauce text with `1) paragraph`, `2) paragraph` renders as a numbered list, not raw text
3. "Spectral Balance Over Time" panel header has `%` and `abs` toggle buttons; clicking switches between normalized % and raw power stacking; preference survives page reload
4. Mix Doctor "Dynamics & Headroom" card shows PLR value (e.g., `PLR 8.4 dB`) and a sub-line with both metrics
