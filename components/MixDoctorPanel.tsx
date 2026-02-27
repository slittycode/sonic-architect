import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Stethoscope,
  ChevronRight,
  CheckCircle2,
  TrendingDown,
  Volume2,
  Radio,
  AlertTriangle,
} from 'lucide-react';
import { MixDoctorReport } from '../types';

interface MixDoctorPanelProps {
  report: MixDoctorReport;
}

// --- Reusable sub-components ---

const DiagnosticCard: React.FC<{
  accentColor: string;
  label: string;
  value?: string;
  children: React.ReactNode;
}> = ({ accentColor, label, value, children }) => (
  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg relative overflow-hidden">
    <div className={`absolute top-0 left-0 w-1 h-full ${accentColor}`}></div>
    <p className="text-xs font-bold text-zinc-300 mb-1 flex justify-between">
      <span>{label}</span>
      {value && <span className="font-mono text-[10px] text-zinc-500">{value}</span>}
    </p>
    <p className="text-xs text-zinc-500 leading-relaxed">{children}</p>
  </div>
);

const MeterBar: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  colorFn: (v: number) => string;
}> = ({ label, value, min, max, unit, colorFn }) => {
  const range = max - min;
  const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{label}</span>
        <span className={`text-xs font-mono font-bold ${colorFn(value)}`}>
          {value} {unit}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorFn(value).replace('text-', 'bg-')}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const MixDoctorPanel: React.FC<MixDoctorPanelProps> = ({ report }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || !report) return;

    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const parentWidth = chartRef.current.clientWidth;
    const width = parentWidth - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const svg = d3
      .select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = report.advice.map((adv) => {
      const target = report.targetProfile.spectralTargets[adv.band];
      return {
        band: adv.band,
        actualDb: adv.diffDb + target.optimalDb,
        optimalDb: target.optimalDb,
        minDb: target.minDb,
        maxDb: target.maxDb,
        issue: adv.issue,
      };
    });

    const x = d3
      .scaleBand()
      .domain(data.map((d) => d.band))
      .range([0, width])
      .padding(0.3);

    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end')
      .style('font-size', '10px')
      .style('fill', '#a1a1aa')
      .style('font-family', 'ui-monospace, monospace');

    const minDbVal = d3.min(data, (d) => Math.min(d.actualDb, d.minDb)) || -60;
    const maxDbVal = d3.max(data, (d) => Math.max(d.actualDb, d.maxDb)) || 0;

    const y = d3
      .scaleLinear()
      .domain([Math.min(-50, minDbVal - 5), Math.max(-5, maxDbVal + 5)])
      .range([height, 0]);

    svg
      .append('g')
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `${d} dB`)
      )
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#a1a1aa')
      .style('font-family', 'ui-monospace, monospace');

    svg.selectAll('.domain').remove();
    svg.selectAll('.tick line').attr('stroke', '#3f3f46').attr('stroke-dasharray', '2,2');

    // Target range rectangles
    svg
      .selectAll('.targetRange')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'targetRange')
      .attr('x', (d) => x(d.band)!)
      .attr('y', (d) => y(d.maxDb))
      .attr('width', x.bandwidth())
      .attr('height', (d) => Math.max(1, y(d.minDb) - y(d.maxDb)))
      .attr('fill', '#3b82f6')
      .attr('opacity', 0.15)
      .attr('rx', 2);

    // Target optimal line
    svg
      .selectAll('.targetLine')
      .data(data)
      .enter()
      .append('line')
      .attr('class', 'targetLine')
      .attr('x1', (d) => x(d.band)! + x.bandwidth() * 0.1)
      .attr('x2', (d) => x(d.band)! + x.bandwidth() * 0.9)
      .attr('y1', (d) => y(d.optimalDb))
      .attr('y2', (d) => y(d.optimalDb))
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8)
      .attr('stroke-dasharray', '4,2');

    // Actual bars
    svg
      .selectAll('.actualBar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'actualBar')
      .attr('x', (d) => x(d.band)! + x.bandwidth() * 0.2)
      .attr('y', (d) => y(Math.max(d.actualDb, -100)))
      .attr('width', x.bandwidth() * 0.6)
      .attr('height', (d) => height - y(Math.max(d.actualDb, -100)))
      .attr('fill', (d) => {
        if (d.issue === 'too-loud') return '#f87171';
        if (d.issue === 'too-quiet') return '#fbbf24';
        return '#34d399';
      })
      .attr('opacity', 0.9)
      .attr('rx', 2);
  }, [report]);

  const lufs = report.loudnessAdvice;
  const stereo = report.stereoAdvice;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg mt-8">
      {/* Header */}
      <div className="px-4 flex items-center justify-between py-3 bg-zinc-800/50 border-b border-zinc-700">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-rose-400" aria-hidden="true" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Mix Doctor</h3>
          {/* Genre badge */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full border border-blue-400/20">
            Comparing to: {report.genre} profile
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
            Health Score
          </span>
          <span
            className={`text-lg font-black ${report.overallScore > 80 ? 'text-emerald-400' : report.overallScore > 50 ? 'text-amber-400' : 'text-rose-400'}`}
          >
            {report.overallScore}/100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        {/* Visualization Area */}
        <div className="lg:col-span-2 p-5 bg-zinc-900">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-zinc-200">
              Spectral Balance vs {report.targetProfile.name} Curve
            </h4>
            <div className="flex gap-4 text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-blue-500/30 rounded-full border border-blue-400"></div>{' '}
                Target Range
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-400 rounded-full"></div> Optimal
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-rose-400 rounded-full"></div> Excess
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-amber-400 rounded-full"></div> Deficit
              </span>
            </div>
          </div>
          <div ref={chartRef} className="w-full h-[250px]" />
        </div>

        {/* Advice Area */}
        <div className="lg:col-span-1 bg-zinc-950 p-5 flex flex-col pt-6">
          <h4 className="text-sm font-semibold text-zinc-200 flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-emerald-400" />
            Diagnosis & Action Items
          </h4>

          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {/* Dynamics block */}
            <DiagnosticCard
              accentColor="bg-blue-500"
              label="Dynamics (Crest Factor)"
              value={`${report.dynamicsAdvice.actualCrest} dB`}
            >
              {report.dynamicsAdvice.message}
            </DiagnosticCard>

            {/* LUFS block */}
            {lufs && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg relative overflow-hidden">
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    lufs.issue === 'too-loud'
                      ? 'bg-rose-500'
                      : lufs.issue === 'too-quiet'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                />
                <div className="flex items-center gap-1.5 mb-2">
                  <Volume2 className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-bold text-zinc-300">Loudness (LUFS)</span>
                </div>
                <div className="space-y-2 mb-2">
                  <MeterBar
                    label="Integrated"
                    value={lufs.actualLufs}
                    min={-30}
                    max={0}
                    unit="LUFS"
                    colorFn={(v) =>
                      lufs.issue === 'optimal'
                        ? 'text-emerald-400'
                        : lufs.issue === 'too-loud'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                    }
                  />
                  <MeterBar
                    label="True Peak"
                    value={lufs.truePeak}
                    min={-20}
                    max={3}
                    unit="dBTP"
                    colorFn={(v) => (v > -1 ? 'text-rose-400' : 'text-emerald-400')}
                  />
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{lufs.message}</p>
              </div>
            )}

            {/* Stereo field block */}
            {stereo && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg relative overflow-hidden">
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    !stereo.monoCompatible
                      ? 'bg-rose-500'
                      : stereo.correlation < 0.2
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                />
                <div className="flex items-center gap-1.5 mb-2">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-zinc-300">Stereo Field</span>
                  {!stereo.monoCompatible && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded">
                      <AlertTriangle className="w-3 h-3" />
                      Phase Risk
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-zinc-950 rounded px-2 py-1.5 border border-zinc-800">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                      Correlation
                    </span>
                    <span
                      className={`text-sm font-mono font-bold ${
                        stereo.correlation < 0
                          ? 'text-rose-400'
                          : stereo.correlation < 0.3
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {stereo.correlation.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-zinc-950 rounded px-2 py-1.5 border border-zinc-800">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                      Width
                    </span>
                    <span className="text-sm font-mono font-bold text-cyan-400">
                      {Math.round(stereo.width * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{stereo.message}</p>
              </div>
            )}

            {/* Spectral issue blocks */}
            {report.advice
              .filter((a) => a.issue !== 'optimal')
              .map((adv, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg relative overflow-hidden group hover:border-zinc-700 transition-colors"
                >
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${adv.issue === 'too-loud' ? 'bg-rose-500' : 'bg-amber-500'}`}
                  ></div>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      {adv.issue === 'too-loud' ? (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
                      )}
                      {adv.band}
                    </p>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${adv.issue === 'too-loud' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}
                    >
                      {adv.diffDb > 0 ? '+' : ''}
                      {adv.diffDb} dB
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{adv.message}</p>
                </div>
              ))}

            {report.advice.filter((a) => a.issue !== 'optimal').length === 0 && !lufs && !stereo && (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-bold text-emerald-400">Perfect Spectral Balance</p>
                <p className="text-xs text-zinc-500 mt-1">
                  This track matches the target genre profile perfectly.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MixDoctorPanel;
