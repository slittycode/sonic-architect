# Plan 4 — Agent Expansion: Session Musician MVP

**Priority:** Future — execute after Plans 1-2 deliver a solid local analysis foundation.  
**Depends on:** Plan 1 (audio feature extraction), Plan 2 (LLM integration optional).  
**Goal:** Build the first "agent" from AGENT_IDEAS.md — audio-to-MIDI transcription — entirely client-side.

---

## Why Session Musician first

From AGENT_IDEAS.md, four agents were proposed: Session Musician, Patch Smith, Mix Doctor, Sample Scout. Session Musician (audio-to-MIDI) is the right first pick because:

1. **Highest producer pain point:** Converting audio ideas to MIDI is tedious manual work. Every DAW user wants this.
2. **Builds on Plan 1 infrastructure:** Pitch detection and onset detection are already needed for the analysis engine.
3. **Fully client-side:** No LLM needed. Pitch detection + onset detection + MIDI serialization = deterministic pipeline.
4. **Tangible output:** A downloadable `.mid` file that users can drag into Ableton. Immediate, testable value.
5. **Clear scope boundary:** Monophonic transcription is achievable and useful. Polyphonic is a stretch goal.

---

## Tasks

### 4.1 — Pitch detection engine

Use Essentia.js `PitchYinFFT` or `PitchMelodia` (from Plan 1's WASM module):

```typescript
// services/pitchDetection.ts
export interface DetectedNote {
  pitch: number;       // MIDI note number (0-127)
  frequency: number;   // Hz
  startTime: number;   // seconds
  duration: number;    // seconds
  velocity: number;    // 0-127, derived from RMS at note onset
  confidence: number;  // 0-1
}

export async function detectPitches(
  audioBuffer: AudioBuffer,
  options?: {
    minFrequency?: number;   // default: 50 Hz (low bass)
    maxFrequency?: number;   // default: 4000 Hz (soprano range)
    hopSize?: number;        // default: 512 samples
    confidenceThreshold?: number; // default: 0.8
  }
): Promise<DetectedNote[]> {
  // 1. Run pitch detection frame-by-frame
  // 2. Group consecutive frames with same pitch into notes
  // 3. Use onset detection to refine note boundaries
  // 4. Derive velocity from RMS energy at each note onset
  // 5. Filter by confidence threshold
}
```

**Monophonic first:** YinFFT is excellent for single-voice detection (bass lines, vocal melodies, lead synths). This is the MVP.

**Polyphonic stretch:** Essentia's `MultiPitchMelodia` or chromagram-based chord detection for chords. More complex, lower accuracy, but valuable.

### 4.2 — MIDI file generation

Use `midi-writer-js` to convert detected notes to a standard MIDI file:

```typescript
// services/midiExport.ts
import MidiWriter from 'midi-writer-js';

export function createMidiFile(
  notes: DetectedNote[],
  bpm: number,
  name: string
): Blob {
  const track = new MidiWriter.Track();
  track.setTempo(bpm);
  track.addTrackName(name);

  for (const note of notes) {
    // Convert seconds to ticks based on BPM
    const startTick = secondsToTicks(note.startTime, bpm);
    const durationTick = secondsToTicks(note.duration, bpm);

    track.addEvent(new MidiWriter.NoteEvent({
      pitch: midiNumberToNoteName(note.pitch),
      velocity: note.velocity,
      startTick,
      duration: `T${durationTick}`,
    }));
  }

  const writer = new MidiWriter.Writer([track]);
  return new Blob([writer.buildFile()], { type: 'audio/midi' });
}
```

### 4.3 — Quantization options

Raw pitch detection produces free-timing notes. Producers usually want quantized MIDI:

- **No quantization:** Preserves original groove/swing (good for sampling human performances)
- **1/16 note grid:** Standard electronic music quantization
- **1/8 note grid:** Looser, for slower material
- **1/4 note grid:** Very loose, for pads and long notes
- **Swing quantization:** Snap to grid with configurable swing amount (50-75%)

```typescript
export function quantizeNotes(
  notes: DetectedNote[],
  bpm: number,
  gridSize: '1/4' | '1/8' | '1/16' | '1/32' | 'off',
  swingAmount: number // 0-100, where 50 = straight
): DetectedNote[] {
  if (gridSize === 'off') return notes;
  // Snap each note's startTime to nearest grid position
  // Apply swing offset to even-numbered grid positions
}
```

### 4.4 — Session Musician UI panel

Add a new section below the blueprint display (or as a tab):

```
┌────────────────────────────────────────────────────────┐
│  🎹 Session Musician — Audio to MIDI                    │
│                                                         │
│  [Piano Roll Visualization]                             │
│  ┌──────────────────────────────────────────┐          │
│  │  ██  ██    ████  ██  ████    ██  ██      │  ← D3   │
│  │██  ██  ████    ██  ██    ████  ██  ██    │  piano   │
│  │  ██      ██      ██      ██      ██      │  roll    │
│  └──────────────────────────────────────────┘          │
│                                                         │
│  Detected: 47 notes | Range: C2-G4 | Confidence: 91%   │
│                                                         │
│  Quantize: [Off] [1/4] [1/8] [●1/16] [1/32]           │
│  Swing: ─────●───── 58%                                │
│                                                         │
│  [▶ Preview MIDI]  [⬇ Download .mid]  [📋 Copy Notes]  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

Components:

- **Piano roll visualizer:** D3-based, shows notes on a time/pitch grid. Color-coded by velocity.
- **Note stats:** Count, range, average confidence
- **Quantization controls:** Grid size selector + swing slider
- **Preview:** Play back the MIDI using Tone.js or a simple Web Audio oscillator
- **Download:** Generates and downloads the `.mid` file
- **Copy:** Copies note data as JSON (for pasting into scripts or other tools)

### 4.5 — Integration with Blueprint flow

The Session Musician should feel like a natural extension of the analysis:

1. User uploads audio → analysis runs (Plan 1)
2. Blueprint displays (existing flow)
3. Below the blueprint, Session Musician shows pitch detection results
4. User can tweak quantization and download MIDI

The pitch detection runs concurrently with the blueprint analysis (both use the same decoded AudioBuffer).

### 4.6 — MIDI preview playback

Use the Web Audio API to synthesize a simple preview:

```typescript
// services/midiPreview.ts
export function previewMidi(
  notes: DetectedNote[],
  audioContext: AudioContext
): { stop: () => void } {
  const oscillators: OscillatorNode[] = [];

  for (const note of notes) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle'; // simple, pleasant tone
    osc.frequency.value = midiToFrequency(note.pitch);
    gain.gain.value = note.velocity / 127 * 0.3;
    osc.connect(gain).connect(audioContext.destination);

    const startTime = audioContext.currentTime + note.startTime;
    osc.start(startTime);
    osc.stop(startTime + note.duration);
    oscillators.push(osc);
  }

  return {
    stop: () => oscillators.forEach(o => { try { o.stop(); } catch {} })
  };
}
```

### 4.7 — Multi-track MIDI (stretch goal)

If the user uploads multiple stems (e.g., bass + lead + drums), generate a multi-track MIDI file with each stem on its own track. This requires Plan 1's audio analysis to run per-stem.

---

## Dependencies to add

```json
{
  "midi-writer-js": "^2.1.4"
}
```

Optionally for richer preview: `tone` (Tone.js) for better MIDI playback with sampled instruments.

---

## Future agents (not in scope, but architecture supports them)

### Patch Smith (Synth Preset Generator)

With Plan 1's spectral analysis, we have the MFCC, spectral centroid, and harmonic content needed to reverse-engineer synth parameters. The output format would be:

- Vital preset (`.vitalpatch` — JSON-based, well-documented)
- Ableton Operator preset (`.adv` — XML)

This is feasible client-side with a static parameter-mapping approach.

### Mix Doctor (Mixing Assistant)

Plan 1 already extracts spectral features that a Mix Doctor would need:

- Spectral centroid per band (EQ analysis)
- Crest factor (dynamics/compression analysis)
- Stereo width (imaging analysis)
- LUFS measurement (loudness analysis)

The Mix Doctor would compare these features against genre-specific reference profiles (stored as a static JSON knowledge base) and generate actionable EQ/compression/stereo recommendations.

### Sample Scout (Library Organizer)

This one is harder in the browser (needs file system access for scanning libraries). Best suited for:

- An Electron/Tauri desktop version of Sonic Architect
- A companion CLI tool (`sonic-scout`) that uses Plan 1's analysis engine
- Integration with the File System Access API for drag-and-drop library scanning

---

## Architecture impact

After Plans 1-4, the codebase structure becomes:

```
services/
  analysisProvider.ts        # Provider abstraction (Plan 1)
  providers/
    localProvider.ts         # Client-side DSP (Plan 1)
    ollamaProvider.ts        # Local LLM (Plan 2)
    geminiProvider.ts        # Cloud API (legacy)
  audioAnalysis.ts           # Feature extraction (Plan 1)
  pitchDetection.ts          # Pitch detection (Plan 4)
  midiExport.ts              # MIDI file generation (Plan 4)
  midiPreview.ts             # Web Audio MIDI preview (Plan 4)
  ollamaClient.ts            # Ollama HTTP client (Plan 2)
data/
  abletonDevices.ts          # Device knowledge base (Plan 1)
  genreProfiles.ts           # Reference profiles for Mix Doctor (future)
components/
  BlueprintDisplay.tsx       # Existing (enhanced)
  WaveformVisualizer.tsx     # Real waveform (Plan 3)
  SessionMusician.tsx        # Piano roll + MIDI export (Plan 4)
  ProviderSettings.tsx       # Provider selection UI (Plan 2)
  ErrorRecovery.tsx          # Error actions (Plan 3)
```

Each agent becomes a new component + service pair that plugs into the shared audio analysis infrastructure. The `AnalysisProvider` abstraction means any agent can run locally, with Ollama enhancement, or with cloud AI — user's choice.
