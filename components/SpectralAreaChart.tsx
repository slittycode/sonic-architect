/**
 * Spectral Area Chart — D3-based stacked area visualisation of per-band energy over time.
 *
 * Each spectral band is rendered as a coloured area, stacked so the total spectral
 * balance shift over time is visible.  Arrangement section markers are overlaid.
 */

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { SpectralTimeline, ArrangementSection } from '../types';

interface SpectralAreaChartProps {
  timeline: SpectralTimeline;
  arrangement: ArrangementSection[];
  duration: number;
  mode?: 'proportional' | 'absolute';
}

// Band colours (bottom to top: Sub Bass → Brilliance)
const BAND_COLORS = [
  '#6366f1', // indigo-500  — Sub Bass
  '#8b5cf6', // violet-500  — Low Bass
  '#a78bfa', // violet-400  — Low Mids
  '#34d399', // emerald-400 — Mids
  '#2dd4bf', // teal-400    — Upper Mids
  '#38bdf8', // sky-400     — Highs
  '#818cf8', // indigo-400  — Brilliance
];

function parseTimeRange(timeRange: string): number {
  const match = timeRange.match(/^(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

const CHART_HEIGHT = 200;

const SpectralAreaChart: React.FC<SpectralAreaChartProps> = ({
  timeline,
  arrangement,
  duration,
  mode = 'proportional',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !timeline.timePoints.length) return;

    // Clear previous chart
    d3.select(containerRef.current).selectAll('*').remove();

    const margin = { top: 14, right: 12, bottom: 28, left: 48 };
    const parentWidth = containerRef.current.clientWidth;
    const width = parentWidth - margin.left - margin.right;
    const height = CHART_HEIGHT - margin.top - margin.bottom;

    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', parentWidth)
      .attr('height', CHART_HEIGHT)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const numPoints = timeline.timePoints.length;
    const bandNames = timeline.bands.map((b) => b.name);

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
        // Proportional: normalise each slice to 100% (shows tonal balance shape)
        // Absolute: raw linear power (stack height rises/falls with total energy)
        row[timeline.bands[b].name] =
          mode === 'proportional' && totalPower > 0 ? (powers[b] / totalPower) * 100 : powers[b];
      }
      data.push(row);
    }

    // Stack
    const stack = d3
      .stack<Record<string, number>>()
      .keys(bandNames)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);
    const series = stack(data);

    // Scales
    const x = d3
      .scaleLinear()
      .domain([timeline.timePoints[0], timeline.timePoints[numPoints - 1]])
      .range([0, width]);

    const yMax = d3.max(series, (s) => d3.max(s, (d) => d[1])) ?? 100;
    const y = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

    const color = d3
      .scaleOrdinal<string>()
      .domain(bandNames)
      .range(BAND_COLORS.slice(0, bandNames.length));

    // Area generator
    const area = d3
      .area<d3.SeriesPoint<Record<string, number>>>()
      .x((d) => x(d.data.time))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(d3.curveBasis);

    // Render areas
    svg
      .selectAll('.band-area')
      .data(series)
      .enter()
      .append('path')
      .attr('class', 'band-area')
      .attr('d', area)
      .attr('fill', (d) => color(d.key))
      .attr('opacity', 0.7);

    // X axis
    const timeStep = duration > 120 ? 30 : duration > 60 ? 15 : duration > 20 ? 5 : 2;
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(d3.range(0, duration + 1, timeStep))
          .tickFormat((d) => {
            const t = d as number;
            const min = Math.floor(t / 60);
            const sec = Math.floor(t % 60);
            return `${min}:${sec.toString().padStart(2, '0')}`;
          })
      )
      .selectAll('text')
      .style('font-size', '9px')
      .style('fill', '#71717a')
      .style('font-family', 'ui-monospace, monospace');

    // Y axis
    svg
      .append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((d) =>
            mode === 'proportional' ? `${Math.round(d as number)}%` : (d as number).toExponential(1)
          )
      )
      .selectAll('text')
      .style('font-size', '9px')
      .style('fill', '#71717a')
      .style('font-family', 'ui-monospace, monospace');

    // Clean up domain lines
    svg.selectAll('.domain').remove();
    svg.selectAll('.tick line').attr('stroke', '#27272a').attr('stroke-dasharray', '2,2');

    // Arrangement section markers
    for (const section of arrangement) {
      const startSec = parseTimeRange(section.timeRange);
      if (startSec <= 0) continue;
      const xPos = x(startSec);

      svg
        .append('line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', 'rgba(139, 92, 246, 0.5)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3');

      svg
        .append('text')
        .attr('x', xPos + 3)
        .attr('y', 10)
        .text(section.label)
        .style('font-size', '8px')
        .style('fill', 'rgba(167, 139, 250, 0.8)')
        .style('font-family', 'ui-monospace, monospace');
    }

    // Legend
    const legendG = svg
      .append('g')
      .attr('transform', `translate(${width - bandNames.length * 70}, ${-10})`);
    bandNames.forEach((name, i) => {
      const g = legendG.append('g').attr('transform', `translate(${i * 70}, 0)`);
      g.append('rect')
        .attr('width', 8)
        .attr('height', 8)
        .attr('rx', 2)
        .attr('fill', BAND_COLORS[i])
        .attr('opacity', 0.8);
      g.append('text')
        .attr('x', 11)
        .attr('y', 7)
        .text(name.replace(' ', ''))
        .style('font-size', '7px')
        .style('fill', '#71717a')
        .style('font-family', 'ui-monospace, monospace');
    });
  }, [timeline, arrangement, duration, mode]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg border border-zinc-800 bg-zinc-950"
      style={{ height: CHART_HEIGHT }}
    />
  );
};

export default SpectralAreaChart;
