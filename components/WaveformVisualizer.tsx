
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface WaveformVisualizerProps {
  audioUrl: string | null;
  isPlaying: boolean;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ audioUrl, isPlaying }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!containerRef.current || !svgRef.current) return;

    // Clear previous
    d3.select(svgRef.current).selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = 120;
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Placeholder visualization
    const barCount = 60;
    const barWidth = (width / barCount) - 2;
    const data = Array.from({ length: barCount }, () => Math.random() * height);

    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d, i) => i * (barWidth + 2))
      .attr('y', d => (height - d) / 2)
      .attr('width', barWidth)
      .attr('height', d => d)
      .attr('fill', '#3b82f6')
      .attr('opacity', 0.6)
      .attr('rx', 2);

    if (isPlaying) {
      const animate = () => {
        svg.selectAll('rect')
          .transition()
          .duration(200)
          .attr('height', () => Math.random() * height)
          .attr('y', (d, i, nodes) => {
            const h = parseFloat(d3.select(nodes[i]).attr('height'));
            return (height - h) / 2;
          });
      };
      const interval = setInterval(animate, 200);
      return () => clearInterval(interval);
    }
  }, [audioUrl, isPlaying]);

  return (
    <div ref={containerRef} className="w-full h-32 bg-zinc-900/50 rounded-lg flex items-center justify-center border border-zinc-800 relative overflow-hidden">
      <svg ref={svgRef} className="z-10"></svg>
      {!audioUrl && <div className="text-zinc-500 text-sm">No audio loaded</div>}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default WaveformVisualizer;
