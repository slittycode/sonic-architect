import React, { useState } from 'react';
import { Activity, Clock, Layers, Cpu, Settings2, Zap, Sparkles, Drum, Fingerprint, Music } from 'lucide-react';
import { ReconstructionBlueprint } from '../types';
import MixDoctorPanel from './MixDoctorPanel';
import SpectralAreaChart from './SpectralAreaChart';
import SpectralHeatmap from './SpectralHeatmap';
import EnhancedAnalysisPanel from './EnhancedAnalysisPanel';

interface BlueprintDisplayProps {
  blueprint: ReconstructionBlueprint;
}

// --- Chord timeline helpers ---
const NOTE_ORDER: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};
function rootNoteIndex(root: string): number {
  return NOTE_ORDER[root] ?? 0;
}
function parseSegTime(timeRange: string, side: 'start' | 'end'): number {
  const parts = timeRange.split('–');
  const s = (side === 'start' ? parts[0] : parts[1] ?? parts[0]).trim();
  const [m, sec] = s.split(':');
  return parseInt(m) * 60 + parseInt(sec ?? '0');
}

// --- Markdown renderer ---
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part) ? (
      <strong key={i} className="text-white font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  );
}
function renderMarkdown(text: string, textClass = 'text-sm text-indigo-200/80'): React.ReactNode {
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
      // Split on inline numbered transitions: "sentence end. 2. next item"
      const subItems = block
        .split(/(?<=[.!?])\s+(?=\d+[.)]\s)/)
        .map((s) => s.replace(/^\d+[.)]\s*/, '').replace(/\n/g, ' ').trim())
        .filter(Boolean);
      if (last?.type === 'ol') {
        last.items.push(...subItems);
      } else {
        groups.push({ type: 'ol', items: subItems });
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

  return groups.map((g, gi) => {
    if (g.type === 'ol') {
      return (
        <ol key={gi} className={`list-decimal list-inside space-y-2 ${textClass}`}>
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
        <ul key={gi} className={`list-disc list-inside space-y-2 ${textClass}`}>
          {g.items.map((item, ii) => (
            <li key={ii} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={gi} className={`leading-relaxed ${textClass}`}>
        {renderInline(g.content)}
      </p>
    );
  });
}

const TelemetryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800">
    <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">{label}</span>
    <span className="text-sm font-semibold text-zinc-200 mono">{value}</span>
  </div>
);

const BlueprintDisplay: React.FC<BlueprintDisplayProps> = ({ blueprint }) => {
  const [spectralMode, setSpectralMode] = useState<'proportional' | 'absolute'>(() => {
    try {
      return (localStorage.getItem('sonic-spectral-mode') as 'proportional' | 'absolute') ?? 'proportional';
    } catch {
      return 'proportional';
    }
  });

  const toggleSpectralMode = (next: 'proportional' | 'absolute') => {
    setSpectralMode(next);
    try { localStorage.setItem('sonic-spectral-mode', next); } catch {}
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Left Column: Telemetry & Arrangement */}
        <div className="lg:col-span-1 space-y-8">
          {/* Telemetry */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Global Telemetry
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 gap-4">
              <TelemetryItem label="BPM" value={blueprint.telemetry.bpm} />
              <TelemetryItem label="Key" value={blueprint.telemetry.key} />
              {blueprint.telemetry.detectedGenre && (
                <TelemetryItem label="Genre" value={blueprint.telemetry.detectedGenre} />
              )}
              <TelemetryItem label="Groove" value={blueprint.telemetry.groove} />

              {/* Beat Tracking */}
              {blueprint.telemetry.beatPositions && blueprint.telemetry.beatPositions.length > 0 && (
                <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Drum className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">
                      Beat Grid
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-300 mono">
                      {blueprint.telemetry.beatPositions.length} beats detected
                    </span>
                    {blueprint.telemetry.downbeatPosition !== undefined && (
                      <span className="text-cyan-400/70 mono">
                        ↓1 @ {blueprint.telemetry.downbeatPosition.toFixed(3)}s
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-px h-3 overflow-hidden rounded">
                    {blueprint.telemetry.beatPositions.slice(0, 64).map((beat, i) => {
                      const isDownbeat = beat === blueprint.telemetry.downbeatPosition;
                      return (
                        <div
                          key={i}
                          className={`flex-1 min-w-[2px] rounded-sm ${isDownbeat ? 'bg-cyan-400' : i % 4 === 0 ? 'bg-zinc-500' : 'bg-zinc-700'}`}
                          title={`Beat ${i + 1}: ${beat.toFixed(3)}s`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1.5">
                    Use beat positions as Ableton warp markers for sample-accurate alignment.
                  </p>
                </div>
              )}

              {blueprint.telemetry.verificationNotes && (
                <div className="p-3 bg-zinc-950 rounded border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider block mb-1.5">
                    Gemini Verification
                  </span>
                  <div className="space-y-2">
                    {renderMarkdown(blueprint.telemetry.verificationNotes, 'text-xs text-zinc-400')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                The Arrangement
              </h3>
            </div>
            <div className="p-0">
              {blueprint.arrangement.map((section, idx) => (
                <div
                  key={idx}
                  className="p-4 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] mono text-blue-400 bg-blue-400/10 px-1.5 rounded">
                      {section.timeRange}
                    </span>
                    <span className="text-xs font-bold text-zinc-200">{section.label}</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{section.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Column: The Rack (Instruments) & Patches */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Instrumentation & Synthesis
              </h3>
            </div>
            <div className="p-0">
              {blueprint.instrumentation.map((inst, idx) => (
                <div
                  key={idx}
                  className="p-5 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/20"
                >
                  <h4 className="text-sm font-bold text-emerald-400 mb-2">{inst.element}</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                        Timbre Analysis
                      </p>
                      <p className="text-xs text-zinc-300 italic">"{inst.timbre}"</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                        Frequency Domain
                      </p>
                      <p className="text-xs text-zinc-300">{inst.frequency}</p>
                    </div>
                    <div className="bg-zinc-950 p-3 rounded-md border border-zinc-800 mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                        <p className="text-[10px] uppercase font-bold text-emerald-600">
                          Ableton 12 Recommendation
                        </p>
                      </div>
                      <p className="text-xs mono text-zinc-400 leading-tight">
                        {inst.abletonDevice}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MFCC Timbre Fingerprint */}
          {blueprint.mfcc && blueprint.mfcc.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-teal-400" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Timbre Fingerprint (MFCC)
                </h3>
              </div>
              <div className="p-5">
                <p className="text-[10px] text-zinc-500 mb-3">
                  13 Mel-Frequency Cepstral Coefficients capturing the timbral character of the audio.
                </p>
                <div className="flex items-end gap-1 h-16">
                  {blueprint.mfcc.map((coeff, i) => {
                    // Normalize coefficients for display (c0 is energy, often much larger)
                    const maxAbs = Math.max(...blueprint.mfcc!.map(Math.abs), 1);
                    const normalized = coeff / maxAbs;
                    const height = Math.abs(normalized) * 100;
                    const isPositive = normalized >= 0;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center justify-end h-full"
                        title={`C${i}: ${coeff.toFixed(2)}`}
                      >
                        <div
                          className={`w-full rounded-sm ${isPositive ? 'bg-teal-500/60' : 'bg-rose-500/40'}`}
                          style={{ height: `${Math.max(2, height)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[8px] mono text-zinc-600">
                  <span>C0 (energy)</span>
                  <span>C6 (detail)</span>
                  <span>C12 (fine)</span>
                </div>
                <div className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
                  {blueprint.mfcc[1] > 0
                    ? 'Positive C1 → brighter, harmonically rich timbre.'
                    : 'Negative C1 → darker, warmer timbral character.'}
                  {' '}
                  {Math.abs(blueprint.mfcc[0]) > 10
                    ? 'High C0 energy — full, loud source material.'
                    : 'Moderate C0 — balanced energy level.'}
                </div>
              </div>
            </div>
          )}

          {/* Patch Smith Section */}
          {blueprint.patches && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
              <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-pink-400" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Patch Smith (Auto-Generated)
                </h3>
              </div>
              <div className="p-5 flex flex-col gap-3">
                <p className="text-xs text-zinc-400 mb-2">
                  Synthesizer parameters procedurally generated from audio features.
                </p>

                <button
                  onClick={() => {
                    const blob = new Blob([blueprint.patches!.vital!], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'patch_smith.vitalpatch';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-between px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors text-xs text-zinc-200"
                >
                  <span>Download Vital Patch</span>
                  <span className="text-[10px] text-zinc-500 font-mono">.vitalpatch</span>
                </button>

                <button
                  onClick={() => {
                    const blob = new Blob([blueprint.patches!.operator!], { type: 'text/xml' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'patch_smith.adv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center justify-between px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors text-xs text-zinc-200"
                >
                  <span>Download Ableton Operator</span>
                  <span className="text-[10px] text-zinc-500 font-mono">.adv</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Effects & Secret Sauce */}
        <div className="lg:col-span-1 space-y-8">
          {/* FX Chain */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-orange-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Effects Chain (The Glue)
              </h3>
            </div>
            <div className="p-0">
              {blueprint.fxChain.map((fx, idx) => (
                <div key={idx} className="p-4 border-b border-zinc-800 last:border-0">
                  <div className="flex gap-3">
                    <div className="mt-1">
                      <Zap className="w-3 h-3 text-orange-500" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-200 mb-1">{fx.artifact}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                        <span className="text-orange-900/80 font-bold mr-1">FIX:</span>
                        {fx.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Secret Sauce */}
          <div className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/30 rounded-xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                The Secret Sauce
              </h3>
            </div>
            <div className="p-6">
              <h4 className="text-base font-bold text-white mb-2">
                {renderMarkdown(blueprint.secretSauce.trick)}
              </h4>
              <div className="text-sm text-indigo-200/80 leading-relaxed space-y-4">
                {renderMarkdown(blueprint.secretSauce.execution)}
              </div>
              <div className="mt-6 pt-4 border-t border-indigo-500/20 flex justify-end">
                <div className="text-[10px] mono text-indigo-400 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
                  PRO TIP IDENTIFIED
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spectral Timeline Visualization */}
      {blueprint.spectralTimeline && blueprint.spectralTimeline.timePoints.length > 0 && (
        <div className="space-y-6 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Spectral Balance Over Time
              </h3>
              <div className="ml-auto flex gap-1">
                {(['proportional', 'absolute'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleSpectralMode(m)}
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
            <div className="p-4">
              <SpectralAreaChart
                timeline={blueprint.spectralTimeline}
                arrangement={blueprint.arrangement}
                duration={blueprint.meta?.duration ?? 0}
                mode={spectralMode}
              />
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Spectral Energy Heatmap
              </h3>
            </div>
            <div className="p-4">
              <SpectralHeatmap
                timeline={blueprint.spectralTimeline}
                arrangement={blueprint.arrangement}
                duration={blueprint.meta?.duration ?? 0}
              />
            </div>
          </div>
        </div>
      )}

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

      {/* Mix Doctor Dashboard */}
      {blueprint.mixReport && <MixDoctorPanel report={blueprint.mixReport} />}

      {/* Enhanced Analysis Panel */}
      <EnhancedAnalysisPanel telemetry={blueprint.telemetry} />
    </>
  );
};

export default BlueprintDisplay;
