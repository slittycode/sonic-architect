
import React, { useState, useRef } from 'react';
import { 
  AudioLines, 
  Upload, 
  Play, 
  Pause, 
  Music2, 
  AlertCircle
} from 'lucide-react';
import { AnalysisStatus, ReconstructionBlueprint } from './types';
import { analyzeAudio } from './services/geminiService';
import WaveformVisualizer from './components/WaveformVisualizer';
import BlueprintDisplay from './components/BlueprintDisplay';

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
              aria-label="Import audio stem"
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
                aria-label={isPlaying ? "Pause playback" : "Start playback"}
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
          <BlueprintDisplay blueprint={blueprint} />
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
              aria-label="Analyze track"
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
          <span className="hidden sm:inline">Reference Model: Gemini 1.5 Pro</span>
          <span>© 2024 Sonic Architect AI</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
