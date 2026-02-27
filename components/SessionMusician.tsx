/**
 * Session Musician — Audio-to-MIDI Transcription Panel
 *
 * Renders a piano-roll visualisation of detected notes, quantisation controls,
 * a MIDI preview player, and a download button.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Music2,
  Download,
  Play,
  Square,
  Loader2,
  Grid3X3,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { DetectedNote, PitchDetectionResult, QuantizeGrid, QuantizeOptions } from '../types';
import { quantizeNotes, gridLabel } from '../services/quantization';
import { downloadMidiFile } from '../services/midiExport';
import { previewNotes, PreviewHandle } from '../services/midiPreview';

// ── Props ──────────────────────────────────────────────────────────────────────

interface SessionMusicianProps {
  /** Pitch detection result (null when not yet run) */
  result: PitchDetectionResult | null;
  /** Whether detection is currently running */
  detecting: boolean;
  /** Error message if detection failed */
  error: string | null;
  /** Original audio file name (for naming the MIDI download) */
  fileName: string | null;
  /** Whether polyphonic (Basic Pitch) mode is active */
  polyMode?: boolean;
  /** Toggle polyphonic mode */
  onPolyModeChange?: (enabled: boolean) => void;
}

// ── Grid options ───────────────────────────────────────────────────────────────

const GRID_OPTIONS: QuantizeGrid[] = ['off', '1/4', '1/8', '1/16', '1/32'];

// ── Piano Roll ─────────────────────────────────────────────────────────────────

const PIANO_ROLL_HEIGHT = 240;
const KEY_WIDTH = 40;
const NOTE_COLORS = {
  fill: '#3b82f6', // blue-500
  fillHigh: '#60a5fa', // blue-400 (high confidence)
  fillLow: '#1e3a5f', // muted blue (low confidence)
  stroke: '#1d4ed8', // blue-700
  grid: '#27272a', // zinc-800
  text: '#a1a1aa', // zinc-400
  bg: '#09090b', // zinc-950
};

function drawPianoRoll(canvas: HTMLCanvasElement, notes: DetectedNote[], duration: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  // Clear
  ctx.fillStyle = NOTE_COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  if (notes.length === 0) {
    ctx.fillStyle = NOTE_COLORS.text;
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No notes detected', w / 2, h / 2);
    return;
  }

  // Compute pitch range
  const midiValues = notes.map((n) => n.midi);
  const minMidi = Math.max(0, Math.min(...midiValues) - 2);
  const maxMidi = Math.min(127, Math.max(...midiValues) + 2);
  const range = maxMidi - minMidi || 1;

  const plotX = KEY_WIDTH;
  const plotW = w - KEY_WIDTH;
  const noteH = Math.max(3, h / range);

  // Draw horizontal grid lines and piano key labels
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'right';
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  for (let midi = minMidi; midi <= maxMidi; midi++) {
    const y = h - ((midi - minMidi) / range) * h;
    const isBlackKey = [1, 3, 6, 8, 10].includes(midi % 12);

    // Grid line
    ctx.strokeStyle = midi % 12 === 0 ? '#3f3f46' : NOTE_COLORS.grid;
    ctx.lineWidth = midi % 12 === 0 ? 1 : 0.5;
    ctx.beginPath();
    ctx.moveTo(plotX, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    // Key label (only for C notes and some others to avoid clutter)
    if (midi % 12 === 0 || range <= 24) {
      const noteName = NOTE_NAMES[midi % 12];
      const octave = Math.floor(midi / 12) - 1;
      ctx.fillStyle = isBlackKey ? '#52525b' : NOTE_COLORS.text;
      ctx.fillText(`${noteName}${octave}`, KEY_WIDTH - 4, y + 3);
    }
  }

  // Draw vertical grid lines (every second)
  const secStep = duration > 30 ? 5 : duration > 10 ? 2 : 1;
  ctx.strokeStyle = NOTE_COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let t = 0; t <= duration; t += secStep) {
    const x = plotX + (t / duration) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();

    // Time label
    ctx.fillStyle = '#52525b';
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${t}s`, x, h - 2);
  }

  // Draw notes
  for (const note of notes) {
    const x = plotX + (note.startTime / duration) * plotW;
    const noteWidth = Math.max(2, (note.duration / duration) * plotW);
    const y = h - ((note.midi - minMidi) / range) * h - noteH / 2;

    // Confidence-based color
    const alpha = 0.4 + note.confidence * 0.6;
    ctx.fillStyle =
      note.confidence > 0.7
        ? NOTE_COLORS.fillHigh
        : note.confidence > 0.3
          ? NOTE_COLORS.fill
          : NOTE_COLORS.fillLow;
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, noteWidth, Math.max(2, noteH - 1));

    ctx.globalAlpha = 1;
    ctx.strokeStyle = NOTE_COLORS.stroke;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, noteWidth, Math.max(2, noteH - 1));
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

const SessionMusician: React.FC<SessionMusicianProps> = ({
  result,
  detecting,
  error,
  fileName,
  polyMode = false,
  onPolyModeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<PreviewHandle | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const [quantizeOptions, setQuantizeOptions] = useState<QuantizeOptions>({
    grid: 'off',
    swing: 0,
  });

  // Apply quantization to notes
  const displayNotes = useMemo(() => {
    if (!result) return [];
    return quantizeNotes(result.notes, result.bpm, quantizeOptions);
  }, [result, quantizeOptions]);

  // Redraw piano roll when notes change or panel re-expands
  useEffect(() => {
    if (!canvasRef.current || !result || !expanded) return;
    drawPianoRoll(canvasRef.current, displayNotes, result.duration);
  }, [displayNotes, result, expanded]);

  // Handle resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result || !expanded) return;

    const observer = new ResizeObserver(() => {
      drawPianoRoll(canvas, displayNotes, result.duration);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [displayNotes, result, expanded]);

  // Stop preview on unmount
  useEffect(() => {
    return () => previewRef.current?.stop();
  }, []);

  const handlePreview = useCallback(() => {
    if (isPreviewing) {
      previewRef.current?.stop();
      previewRef.current = null;
      setIsPreviewing(false);
      return;
    }

    if (displayNotes.length === 0) return;

    const handle = previewNotes(displayNotes, () => {
      setIsPreviewing(false);
      previewRef.current = null;
    });
    previewRef.current = handle;
    setIsPreviewing(true);
  }, [isPreviewing, displayNotes]);

  const handleDownload = useCallback(() => {
    if (displayNotes.length === 0 || !result) return;
    const baseName = fileName?.replace(/\.[^.]+$/, '') ?? 'transcription';
    downloadMidiFile(displayNotes, result.bpm, `${baseName}.mid`);
  }, [displayNotes, result, fileName]);

  // Note stats
  const stats = useMemo(() => {
    if (!displayNotes.length) return null;
    const midiValues = displayNotes.map((n) => n.midi);
    const minNote = Math.min(...midiValues);
    const maxNote = Math.max(...midiValues);
    const avgConf = displayNotes.reduce((s, n) => s + n.confidence, 0) / displayNotes.length;
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const toName = (m: number) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
    return {
      count: displayNotes.length,
      range: `${toName(minNote)} — ${toName(maxNote)}`,
      avgConfidence: Math.round(avgConf * 100),
      totalDuration: displayNotes.reduce((s, n) => s + n.duration, 0).toFixed(1),
    };
  }, [displayNotes]);

  // ── Loading state ──────────────────────────────────────────────────────────

  if (detecting) {
    return (
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-zinc-800 rounded-full">
            <Music2 className="w-5 h-5 text-violet-400" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Session Musician
          </h2>
        </div>
        <div className="flex items-center gap-4 p-4 bg-violet-900/20 border border-violet-800/50 rounded-lg animate-pulse">
          <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-violet-200">Detecting pitches…</span>
            <span className="text-xs text-violet-400/80">
              {polyMode
                ? 'Running Basic Pitch polyphonic detection (TF.js)'
                : 'Running YIN autocorrelation on audio frames'}
            </span>
          </div>
        </div>
      </section>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-zinc-800 rounded-full">
            <Music2 className="w-5 h-5 text-violet-400" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Session Musician
          </h2>
        </div>
        <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-sm text-red-200">
          {error}
        </div>
      </section>
    );
  }

  // ── No result yet ──────────────────────────────────────────────────────────

  if (!result) return null;

  // ── Main display ───────────────────────────────────────────────────────────

  return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-900/30 rounded-full border border-violet-700/30">
            <Music2 className="w-5 h-5 text-violet-400" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
              Session Musician
            </h2>
            <p className="text-[10px] text-zinc-500 mono tracking-widest uppercase">
              Audio → MIDI Transcription
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Preview button */}
          <button
            onClick={handlePreview}
            disabled={displayNotes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-800/40 hover:bg-violet-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-violet-200 text-xs rounded-md transition-all border border-violet-700/40"
            title={isPreviewing ? 'Stop preview' : 'Preview MIDI'}
          >
            {isPreviewing ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isPreviewing ? 'Stop' : 'Preview'}
          </button>

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={displayNotes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/60 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200 text-xs rounded-md transition-all border border-zinc-700/50"
            title="Download .mid file"
          >
            <Download className="w-3.5 h-3.5" />
            Download .mid
          </button>

          {/* Poly/Mono mode toggle */}
          {onPolyModeChange && (
            <button
              onClick={() => onPolyModeChange(!polyMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all border ${
                polyMode
                  ? 'bg-amber-800/40 text-amber-200 border-amber-700/40 hover:bg-amber-700/50'
                  : 'bg-zinc-800/40 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
              title={
                polyMode
                  ? 'Polyphonic mode (Basic Pitch) — re-analyze to apply'
                  : 'Monophonic mode (YIN) — switch to poly for chords/multi-note'
              }
            >
              <Music2 className="w-3.5 h-3.5" />
              {polyMode ? 'Poly' : 'Mono'}
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Stats bar */}
          {stats && (
            <div className="flex items-center gap-4 text-[10px] mono text-zinc-500 uppercase tracking-widest mb-3 px-1">
              <span>{stats.count} notes</span>
              <span className="text-zinc-700">|</span>
              <span>Range: {stats.range}</span>
              <span className="text-zinc-700">|</span>
              <span>Confidence: {stats.avgConfidence}%</span>
              <span className="text-zinc-700">|</span>
              <span>Duration: {stats.totalDuration}s</span>
            </div>
          )}

          {/* Piano roll canvas */}
          <div className="rounded-lg border border-zinc-800 overflow-hidden mb-4">
            <canvas ref={canvasRef} className="w-full" style={{ height: PIANO_ROLL_HEIGHT }} />
          </div>

          {/* Quantization controls */}
          <div className="flex items-center gap-6 p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Grid3X3 className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                Quantize
              </span>
            </div>

            {/* Grid selector */}
            <div className="flex items-center gap-1">
              {GRID_OPTIONS.map((grid) => (
                <button
                  key={grid}
                  onClick={() => setQuantizeOptions((prev) => ({ ...prev, grid }))}
                  className={`px-2.5 py-1 text-xs rounded transition-all ${
                    quantizeOptions.grid === grid
                      ? 'bg-violet-700/50 text-violet-200 border border-violet-600/50'
                      : 'bg-zinc-800/40 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {gridLabel(grid)}
                </button>
              ))}
            </div>

            {/* Swing slider */}
            <div className="flex items-center gap-2 ml-auto">
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-[10px] text-zinc-500 uppercase">Swing</span>
              <input
                type="range"
                min={0}
                max={100}
                value={quantizeOptions.swing}
                onChange={(e) =>
                  setQuantizeOptions((prev) => ({
                    ...prev,
                    swing: Number(e.target.value),
                  }))
                }
                disabled={quantizeOptions.grid === 'off'}
                className="w-20 h-1 accent-violet-500 disabled:opacity-30"
              />
              <span className="text-[10px] text-zinc-500 tabular-nums w-7 text-right">
                {quantizeOptions.swing}%
              </span>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 mt-3 text-[10px] text-zinc-600">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              {polyMode
                ? 'Polyphonic detection via Spotify Basic Pitch (TF.js). Handles chords, multi-instrument audio, and complex polyphony. Toggle to Mono for single-instrument stems.'
                : 'Monophonic pitch detection via YIN autocorrelation. Best results with clean, single-instrument stems. Toggle to Poly for chords and multi-note content.'}
              {' '}Adjust quantization to snap notes to the rhythmic grid before downloading.
            </span>
          </div>
        </>
      )}
    </section>
  );
};

export default SessionMusician;
