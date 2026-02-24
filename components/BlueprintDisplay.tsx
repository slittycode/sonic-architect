import React from 'react';
import { Activity, Clock, Layers, Cpu, Settings2, Zap, Sparkles } from 'lucide-react';
import { ReconstructionBlueprint } from '../types';
import MixDoctorPanel from './MixDoctorPanel';

interface BlueprintDisplayProps {
  blueprint: ReconstructionBlueprint;
}

const TelemetryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800">
    <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">{label}</span>
    <span className="text-sm font-semibold text-zinc-200 mono">{value}</span>
  </div>
);

const BlueprintDisplay: React.FC<BlueprintDisplayProps> = ({ blueprint }) => {
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
              <TelemetryItem label="Groove" value={blueprint.telemetry.groove} />
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
              <h4 className="text-base font-bold text-white mb-2">{blueprint.secretSauce.trick}</h4>
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

      {/* Mix Doctor Dashboard */}
      {blueprint.mixReport && <MixDoctorPanel report={blueprint.mixReport} />}
    </>
  );
};

export default BlueprintDisplay;
