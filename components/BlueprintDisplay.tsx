import React, { useRef } from 'react';
import {
  Activity,
  Clock,
  Layers,
  Cpu,
  Settings2,
  Zap,
  Sparkles,
  Download,
  Music,
} from 'lucide-react';
import { ReconstructionBlueprint } from '../types';
import BlueprintNavigation from './BlueprintNavigation';

interface BlueprintDisplayProps {
  blueprint: ReconstructionBlueprint;
  filename?: string | null;
}

const TelemetryItem: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800">
    <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">
      {label}
    </span>
    <span className="text-sm font-semibold text-zinc-200 mono">{value}</span>
  </div>
);

const BlueprintDisplay: React.FC<BlueprintDisplayProps> = ({
  blueprint,
  filename,
}) => {
  const telemetryRef = useRef<HTMLDivElement>(null);
  const arrangementRef = useRef<HTMLDivElement>(null);
  const instrumentsRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const secretSauceRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (sectionId: string) => {
    const refs: Record<string, React.RefObject<HTMLDivElement>> = {
      'telemetry': telemetryRef,
      'arrangement': arrangementRef,
      'instruments': instrumentsRef,
      'fx': fxRef,
      'secret-sauce': secretSauceRef,
    };

    const targetRef = refs[sectionId];
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const handleDownloadBlueprint = () => {
    const originalFilename = filename?.trim() || 'blueprint';
    const baseFilename = originalFilename.replace(/\.[^/.]+$/, '') || 'blueprint';
    const exportFilename = `${baseFilename}-blueprint.json`;
    const exportPayload = {
      metadata: {
        exportedAt: new Date().toISOString(),
        provider: blueprint.meta?.provider ?? 'unknown',
        filename: originalFilename,
      },
      blueprint,
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <BlueprintNavigation onNavigate={handleNavigate} />
      
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleDownloadBlueprint}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold uppercase tracking-wide rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          Download Blueprint
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Left Column: Telemetry & Arrangement */}
      <div className="lg:col-span-1 space-y-8">
        {/* Telemetry */}
        <div ref={telemetryRef} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg scroll-mt-24">
          <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Global Telemetry
            </h3>
          </div>
          <div className="p-5 grid grid-cols-1 gap-4">
            <TelemetryItem label="BPM" value={blueprint.telemetry.bpm} />
            <TelemetryItem label="Key" value={blueprint.telemetry.key} />
            <TelemetryItem label="Groove" value={blueprint.telemetry.groove} />
          </div>
        </div>

        {/* Timeline */}
        <div ref={arrangementRef} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg scroll-mt-24">
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
                  <span className="text-xs font-bold text-zinc-200">
                    {section.label}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {section.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Chord Progression */}
        {blueprint.chordProgression && blueprint.chordProgression.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg scroll-mt-24">
            <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
              <Music className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                Chord Progression
              </h3>
            </div>
            {blueprint.chordProgressionSummary && (
              <div className="px-5 pt-4 pb-2">
                <p className="text-sm font-semibold text-amber-300 mono tracking-wide">
                  {blueprint.chordProgressionSummary}
                </p>
              </div>
            )}
            <div className="p-0">
              {blueprint.chordProgression.map((chord, idx) => (
                <div
                  key={idx}
                  className="px-5 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] mono text-amber-400 bg-amber-400/10 px-1.5 rounded">
                      {chord.timeRange}
                    </span>
                    <span className="text-sm font-bold text-zinc-100">
                      {chord.chord}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {chord.quality}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className="h-1.5 rounded-full bg-amber-400/80"
                      style={{ width: `${Math.round(chord.confidence * 40)}px` }}
                    />
                    <span className="text-[9px] mono text-zinc-600">
                      {Math.round(chord.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Middle Column: The Rack (Instruments) */}
      <div className="lg:col-span-1 space-y-6">
        <div ref={instrumentsRef} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg scroll-mt-24">
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
                <h4 className="text-sm font-bold text-emerald-400 mb-2">
                  {inst.element}
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Timbre Analysis
                    </p>
                    <p className="text-xs text-zinc-300 italic">
                      "{inst.timbre}"
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                      Frequency Domain
                    </p>
                    <p className="text-xs text-zinc-300">{inst.frequency}</p>
                  </div>
                  <div className="bg-zinc-950 p-3 rounded-md border border-zinc-800 mt-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu
                        className="w-3 h-3 text-emerald-500"
                        aria-hidden="true"
                      />
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
      </div>

      {/* Right Column: Effects & Secret Sauce */}
      <div className="lg:col-span-1 space-y-8">
        {/* FX Chain */}
        <div ref={fxRef} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg scroll-mt-24">
          <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-orange-400" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              Effects Chain (The Glue)
            </h3>
          </div>
          <div className="p-0">
            {blueprint.fxChain.map((fx, idx) => (
              <div
                key={idx}
                className="p-4 border-b border-zinc-800 last:border-0"
              >
                <div className="flex gap-3">
                  <div className="mt-1">
                    <Zap
                      className="w-3 h-3 text-orange-500"
                      aria-hidden="true"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-200 mb-1">
                      {fx.artifact}
                    </p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                      <span className="text-orange-900/80 font-bold mr-1">
                        FIX:
                      </span>
                      {fx.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Secret Sauce */}
        <div ref={secretSauceRef} className="bg-gradient-to-br from-indigo-900/30 to-purple-900/20 border border-indigo-500/30 rounded-xl overflow-hidden shadow-xl scroll-mt-24">
          <div className="px-4 py-3 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">
              The Secret Sauce
            </h3>
          </div>
          <div className="p-6">
            <h4 className="text-base font-bold text-white mb-2">
              {blueprint.secretSauce.trick}
            </h4>
            <div className="text-sm text-indigo-200/80 leading-relaxed space-y-4">
              <p>{blueprint.secretSauce.execution}</p>
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
    </div>
  );
};

export default BlueprintDisplay;
