
import React, { useState, useRef, useCallback } from 'react';
import { 
  AudioLines, 
  Upload, 
  Play, 
  Pause, 
  Settings2, 
  Layers, 
  Zap, 
  Sparkles, 
  Music2, 
  Activity,
  Cpu,
  AlertCircle,
  Clock
} from 'lucide-react';
import { AnalysisStatus, ReconstructionBlueprint } from './types';
import { analyzeAudio } from './services/geminiService';
import WaveformVisualizer from './components/WaveformVisualizer';

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [blueprint, setBlueprint] = useState<ReconstructionBlueprint | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Trigger analysis immediately on upload
    await triggerAnalysis(file);
  };

  const triggerAnalysis = async (file: File) => {
    setStatus(AnalysisStatus.ANALYZING);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await analyzeAudio(base64, file.type);
        setBlueprint(result);
        setStatus(AnalysisStatus.COMPLETED);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-20">
      {/* Header */}
      <header className="w-full border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
              <AudioLines className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 uppercase">Sonic Architect</h1>
              <p className="text-[10px] text-zinc-500 mono tracking-widest uppercase">Ableton Live 12 Deconstructor v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-md transition-all border border-zinc-700"
            >
              <Upload className="w-4 h-4" />
              Import Stem
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="audio/*"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full px-6 mt-8 space-y-8">
        {/* Playback & Visualization */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-full">
                <Music2 className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-zinc-300 mono">{fileName || 'Awaiting Input...'}</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlayback}
                disabled={!audioUrl}
                className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-full text-white transition-all transform active:scale-95"
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
              </button>
            </div>
          </div>
          
          <WaveformVisualizer audioUrl={audioUrl} isPlaying={isPlaying} />
          
          {audioUrl && (
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}

          {status === AnalysisStatus.ANALYZING && (
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg flex items-center gap-4 animate-pulse">
              <Activity className="w-5 h-5 text-blue-400 animate-spin" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-blue-200">Neural Engine Analyzing Spectrogram...</span>
                <span className="text-xs text-blue-400/80">Identifying transients, frequency domains, and device chains...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg flex items-center gap-3 text-red-200">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </section>

        {blueprint && status === AnalysisStatus.COMPLETED && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* Left Column: Telemetry & Arrangement */}
            <div className="lg:col-span-1 space-y-8">
              {/* Telemetry */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Global Telemetry</h3>
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
                  <Clock className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">The Arrangement</h3>
                </div>
                <div className="p-0">
                  {blueprint.arrangement.map((section, idx) => (
                    <div key={idx} className="p-4 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] mono text-blue-400 bg-blue-400/10 px-1.5 rounded">{section.timeRange}</span>
                        <span className="text-xs font-bold text-zinc-200">{section.label}</span>
                      </div>
                      <p className="text-xs text-zinc-500 leading-relaxed">{section.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle Column: The Rack (Instruments) */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Instrumentation & Synthesis</h3>
                </div>
                <div className="p-0">
                  {blueprint.instrumentation.map((inst, idx) => (
                    <div key={idx} className="p-5 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/20">
                      <h4 className="text-sm font-bold text-emerald-400 mb-2">{inst.element}</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Timbre Analysis</p>
                          <p className="text-xs text-zinc-300 italic">"{inst.timbre}"</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Frequency Domain</p>
                          <p className="text-xs text-zinc-300">{inst.frequency}</p>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-md border border-zinc-800 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <Cpu className="w-3 h-3 text-emerald-500" />
                            <p className="text-[10px] uppercase font-bold text-emerald-600">Ableton 12 Recommendation</p>
                          </div>
                          <p className="text-xs mono text-zinc-400 leading-tight">{inst.abletonDevice}</p>
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
                <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-orange-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Effects Chain (The Glue)</h3>
                </div>
                <div className="p-0">
                  {blueprint.fxChain.map((fx, idx) => (
                    <div key={idx} className="p-4 border-b border-zinc-800 last:border-0">
                      <div className="flex gap-3">
                        <div className="mt-1">
                          <Zap className="w-3 h-3 text-orange-500" />
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
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">The Secret Sauce</h3>
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
        )}

        {!blueprint && status === AnalysisStatus.IDLE && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-xl">
              <Upload className="w-8 h-8 text-zinc-600" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Ready to Deconstruct</h2>
              <p className="text-zinc-500 text-sm">Upload an audio file to generate a complete Ableton Live 12 reconstruction blueprint. Our neural engine will map out every device and signal path.</p>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all shadow-lg shadow-blue-500/20 active:scale-95"
            >
              Analyze Track
            </button>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="fixed bottom-0 w-full bg-zinc-950/80 backdrop-blur-sm border-t border-zinc-900 py-3">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[10px] mono text-zinc-600 uppercase tracking-widest">
          <span>Engine Status: Nominal</span>
          <span className="hidden sm:inline">Reference Model: Gemini 3 Pro</span>
          <span>© 2024 Sonic Architect AI</span>
        </div>
      </footer>
    </div>
  );
};

const TelemetryItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between p-3 bg-zinc-950 rounded border border-zinc-800">
    <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">{label}</span>
    <span className="text-sm font-semibold text-zinc-200 mono">{value}</span>
  </div>
);

export default App;
