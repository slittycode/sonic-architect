import React, { useCallback, useEffect, useRef, useState } from 'react';

interface WaveformVisualizerProps {
  audioUrl: string | null;
  peaks: number[] | null;
  duration: number;
  playbackProgress: number;
  onSeek?: (time: number) => void;
  onFileDrop?: (file: File) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = React.memo(
  ({ audioUrl, peaks, duration, playbackProgress, onSeek, onFileDrop }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const draw = useCallback(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const width = container.clientWidth;
      const height = 120;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = '#0f0f12';
      ctx.fillRect(0, 0, width, height);

      if (!audioUrl) {
        ctx.fillStyle = '#71717a';
        ctx.font = '13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No audio loaded', width / 2, height / 2);
        return;
      }

      if (!peaks || peaks.length === 0) {
        ctx.fillStyle = '#3f3f46';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Decoding waveform…', width / 2, height / 2);
        return;
      }

      const centerY = height / 2;
      const barWidth = width / peaks.length;

      for (let i = 0; i < peaks.length; i++) {
        const value = clamp(peaks[i], 0, 1);
        const barHeight = Math.max(1, value * (height * 0.9));
        const x = i * barWidth;
        const y = centerY - barHeight / 2;

        ctx.fillStyle = '#3b82f6';
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
      ctx.globalAlpha = 1;

      // Cursor
      const progress = clamp(playbackProgress, 0, 1);
      const cursorX = progress * width;
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
    }, [audioUrl, peaks, playbackProgress]);

    useEffect(() => {
      draw();
    }, [draw]);

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver(() => draw());
      observer.observe(container);
      return () => observer.disconnect();
    }, [draw]);

    const handleSeek = useCallback(
      (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!audioUrl || !onSeek || duration <= 0 || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        onSeek(ratio * duration);
      },
      [audioUrl, duration, onSeek]
    );

    return (
      <div
        ref={containerRef}
        className={`w-full h-32 bg-zinc-900/50 rounded-lg border relative overflow-hidden transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onFileDrop) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file && onFileDrop) onFileDrop(file);
        }}
      >
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${audioUrl && duration > 0 ? 'cursor-pointer' : ''}`}
          onClick={handleSeek}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none" />
      </div>
    );
  }
);

export default WaveformVisualizer;
