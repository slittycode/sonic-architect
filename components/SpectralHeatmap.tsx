/**
 * Spectral Heatmap — Canvas-based per-band energy over time.
 *
 * Rows: 7 spectral bands (Sub Bass at bottom, Brilliance at top)
 * Columns: time points
 * Color: energy intensity (dark → cyan → yellow → red)
 * Overlay: arrangement section boundaries as vertical dashed lines with labels.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { SpectralTimeline, ArrangementSection } from '../types';

interface SpectralHeatmapProps {
  timeline: SpectralTimeline;
  arrangement: ArrangementSection[];
  duration: number;
}

// Color ramp: -100 dB (silence) → 0 dBFS (loud)
// Maps a dB value to an RGBA string.
function dbToColor(db: number): string {
  // Clamp to useful range
  const clamped = Math.max(-60, Math.min(0, db));
  // Normalise to 0-1 (0 = -60 dB, 1 = 0 dB)
  const t = (clamped + 60) / 60;

  if (t < 0.25) {
    // Black → deep blue
    const u = t / 0.25;
    return `rgba(${Math.round(u * 10)}, ${Math.round(u * 20)}, ${Math.round(40 + u * 80)}, 1)`;
  } else if (t < 0.5) {
    // Deep blue → cyan
    const u = (t - 0.25) / 0.25;
    return `rgba(${Math.round(10 + u * 20)}, ${Math.round(20 + u * 200)}, ${Math.round(120 + u * 135)}, 1)`;
  } else if (t < 0.75) {
    // Cyan → yellow
    const u = (t - 0.5) / 0.25;
    return `rgba(${Math.round(30 + u * 225)}, ${Math.round(220 + u * 35)}, ${Math.round(255 - u * 200)}, 1)`;
  } else {
    // Yellow → red/white
    const u = (t - 0.75) / 0.25;
    return `rgba(${Math.round(255)}, ${Math.round(255 - u * 140)}, ${Math.round(55 - u * 55)}, 1)`;
  }
}

function parseTimeRange(timeRange: string): number {
  // Expects "0:00 – 0:45" or "0:00 - 0:45"; extract the start seconds.
  const match = timeRange.match(/^(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

const LABEL_WIDTH = 80;
const ROW_HEIGHT = 22;

const SpectralHeatmap: React.FC<SpectralHeatmapProps> = ({ timeline, arrangement, duration }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const plotX = LABEL_WIDTH;
    const plotW = w - LABEL_WIDTH;
    const numBands = timeline.bands.length;
    const numPoints = timeline.timePoints.length;

    // Background
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, w, h);

    if (numPoints === 0 || numBands === 0) return;

    const cellW = plotW / numPoints;
    const cellH = h / numBands;

    // Draw heatmap cells (bands ordered bottom-to-top: index 0 = Sub Bass at bottom)
    for (let b = 0; b < numBands; b++) {
      const rowY = h - (b + 1) * cellH; // flip so Sub Bass is at bottom
      const band = timeline.bands[b];

      for (let p = 0; p < numPoints; p++) {
        const x = plotX + p * cellW;
        ctx.fillStyle = dbToColor(band.energyDb[p]);
        ctx.fillRect(x, rowY, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }

    // Draw band labels
    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let b = 0; b < numBands; b++) {
      const rowY = h - (b + 1) * cellH + cellH / 2;
      ctx.fillStyle = '#71717a';
      ctx.fillText(timeline.bands[b].name, LABEL_WIDTH - 6, rowY);
    }

    // Draw arrangement section markers
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    for (const section of arrangement) {
      const startSec = parseTimeRange(section.timeRange);
      if (startSec <= 0) continue;
      const x = plotX + (startSec / duration) * plotW;

      ctx.strokeStyle = 'rgba(139, 92, 246, 0.6)'; // violet
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Section label
      ctx.save();
      ctx.setLineDash([]);
      ctx.font = '8px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(167, 139, 250, 0.8)';
      ctx.fillText(section.label, x + 3, 10);
      ctx.restore();
    }
    ctx.setLineDash([]);

    // Time axis labels
    const timeStep = duration > 120 ? 30 : duration > 60 ? 15 : duration > 20 ? 5 : 2;
    ctx.font = '8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#52525b';
    for (let t = 0; t <= duration; t += timeStep) {
      const x = plotX + (t / duration) * plotW;
      const min = Math.floor(t / 60);
      const sec = Math.floor(t % 60);
      ctx.fillText(`${min}:${sec.toString().padStart(2, '0')}`, x, h - 2);
    }
  }, [timeline, arrangement, duration]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const canvasHeight = Math.max(timeline.bands.length * ROW_HEIGHT, 140);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-zinc-800"
      style={{ height: canvasHeight }}
    />
  );
};

export default SpectralHeatmap;
