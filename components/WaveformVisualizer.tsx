
import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';

interface WaveformVisualizerProps {
  audioUrl: string | null;
  isPlaying: boolean;
  peaks: Float32Array | null;
  duration: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

/** Downsample raw channel data into peak values for visualization. */
function extractPeaks(data: Float32Array, numBars: number): number[] {
  const blockSize = Math.floor(data.length / numBars);
  if (blockSize === 0) return Array.from({ length: numBars }, () => 0);
  const peaks: number[] = [];
  for (let i = 0; i < numBars; i++) {
    let max = 0;
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(data[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
  }
  return peaks;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = React.memo(
  ({ audioUrl, isPlaying, peaks: rawPeaks, duration, audioRef }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number>(0);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    const NUM_BARS = 200;
    const BAR_GAP = 1;
    const CANVAS_HEIGHT = 128;

    // Downsample raw channel data to display bars
    const peakData = useMemo(() => {
      if (!rawPeaks) return null;
      return extractPeaks(rawPeaks, NUM_BARS);
    }, [rawPeaks]);

    // Resize observer
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        const { width } = entries[0].contentRect;
        setDimensions({ width, height: CANVAS_HEIGHT });
      });
      observer.observe(container);
      // Initial dimension
      setDimensions({ width: container.clientWidth, height: CANVAS_HEIGHT });

      return () => observer.disconnect();
    }, []);

    // Draw waveform and playback cursor
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !peakData) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensions;
      if (width === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, width, height);

      const barWidth = Math.max(1, (width / NUM_BARS) - BAR_GAP);
      const currentTime = audioRef.current?.currentTime ?? 0;
      const progress = duration > 0 ? currentTime / duration : 0;
      const playedBars = Math.floor(progress * NUM_BARS);

      // Normalize peaks
      const maxPeak = Math.max(...peakData, 0.01);

      // Draw bars
      for (let i = 0; i < peakData.length; i++) {
        const normalized = peakData[i] / maxPeak;
        const barHeight = Math.max(2, normalized * (height - 4));
        const x = i * (barWidth + BAR_GAP);
        const y = (height - barHeight) / 2;

        if (i < playedBars) {
          ctx.fillStyle = '#3b82f6'; // blue-500 — played
        } else if (i === playedBars) {
          ctx.fillStyle = '#60a5fa'; // blue-400 — current
        } else {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.35)'; // dimmed unplayed
        }

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 1);
        ctx.fill();
      }

      // Draw playback cursor line
      if (duration > 0 && audioRef.current) {
        const cursorX = progress * width;
        ctx.beginPath();
        ctx.strokeStyle = '#f8fafc'; // white
        ctx.lineWidth = 1.5;
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, height);
        ctx.stroke();

        // Time label
        const mins = Math.floor(currentTime / 60);
        const secs = Math.floor(currentTime % 60);
        const totalMins = Math.floor(duration / 60);
        const totalSecs = Math.floor(duration % 60);
        const timeStr = `${mins}:${secs.toString().padStart(2, '0')} / ${totalMins}:${totalSecs.toString().padStart(2, '0')}`;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(244, 244, 245, 0.7)';
        const textWidth = ctx.measureText(timeStr).width;
        const textX = Math.min(cursorX + 6, width - textWidth - 4);
        ctx.fillText(timeStr, textX, 12);
      }
    }, [peakData, dimensions, duration, audioRef]);

    // Animation loop during playback
    useEffect(() => {
      if (!peakData) return;

      if (isPlaying) {
        const animate = () => {
          draw();
          animationRef.current = requestAnimationFrame(animate);
        };
        animationRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationRef.current);
      } else {
        // Draw static frame when paused
        draw();
      }
    }, [isPlaying, draw, peakData]);

    // Click-to-seek
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!audioRef.current || duration === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = x / rect.width;
        audioRef.current.currentTime = ratio * duration;
        draw();
      },
      [audioRef, duration, draw],
    );

    return (
      <div
        ref={containerRef}
        className="w-full h-32 bg-zinc-900/50 rounded-lg flex items-center justify-center border border-zinc-800 relative overflow-hidden"
      >
        {peakData ? (
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            className="z-10 cursor-pointer"
            style={{ width: dimensions.width, height: dimensions.height }}
          />
        ) : (
          <div className="text-zinc-500 text-sm">
            {audioUrl ? 'Decoding audio...' : 'No audio loaded'}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none" />
      </div>
    );
  },
);

export default WaveformVisualizer;
