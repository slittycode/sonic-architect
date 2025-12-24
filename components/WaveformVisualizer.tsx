
import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';

interface WaveformVisualizerProps {
  audioUrl: string | null;
  isPlaying: boolean;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = React.memo(({ audioUrl, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Store the initial random data so it doesn't change on re-renders/play toggle
  const initialData = useMemo(() => {
    // Re-generate only if audioUrl changes (mocking new file analysis)
    return Array.from({ length: 60 }, () => Math.random());
  }, [audioUrl]);

  // Initialization Effect: Draw the chart structure
  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    // Clear previous elements only when audioUrl changes (or on mount)
    const svgSelection = d3.select(svgRef.current);
    svgSelection.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = 120;

    svgSelection
      .attr('width', width)
      .attr('height', height);

    const barCount = 60;
    const barWidth = (width / barCount) - 2;

    // Scale data to height
    const scaledData = initialData.map(v => v * height);

    svgSelection.selectAll('rect')
      .data(scaledData)
      .enter()
      .append('rect')
      .attr('x', (d, i) => i * (barWidth + 2))
      .attr('y', d => (height - d) / 2)
      .attr('width', barWidth)
      .attr('height', d => d)
      .attr('fill', '#3b82f6')
      .attr('opacity', 0.6)
      .attr('rx', 2);

  }, [audioUrl, initialData]);

  // Animation Effect: Handle Play/Pause
  useEffect(() => {
    if (!isPlaying || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const height = 120;

    // Animate bars to random heights to simulate visualization
    const interval = setInterval(() => {
         svg.selectAll('rect').each(function() {
            const rect = d3.select(this);
            const newHeight = Math.random() * height;
            rect.transition()
                .duration(200)
                .attr('height', newHeight)
                .attr('y', (height - newHeight) / 2);
         });
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div ref={containerRef} className="w-full h-32 bg-zinc-900/50 rounded-lg flex items-center justify-center border border-zinc-800 relative overflow-hidden">
      <svg ref={svgRef} className="z-10"></svg>
      {!audioUrl && <div className="text-zinc-500 text-sm">No audio loaded</div>}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none"></div>
    </div>
  );
});

export default WaveformVisualizer;
