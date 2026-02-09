
import React, { useState, useRef, useEffect } from 'react';
import { 
  AudioLines, 
  Upload, 
  Play, 
  Pause, 
  Music2, 
  AlertCircle,
  Activity
} from 'lucide-react';
import { AnalysisStatus, ReconstructionBlueprint } from './types';
import BlueprintDisplay from './components/BlueprintDisplay';
import WaveformSkeleton from './components/WaveformSkeleton';

const WaveformVisualizer = React.lazy(() => import('./components/WaveformVisualizer'));

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [blueprint, setBlueprint] = useState<ReconstructionBlueprint | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasApiKey = Boolean(
    import.meta.env.VITE_GEMINI_API_KEY &&
    String(import.meta.env.VITE_GEMINI_API_KEY).trim()
  );

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Security: Reset error state
    setError(null);

    // Security: Input Validation
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds limit (${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB). Please upload a smaller stem.`);
      return;
    }

    // Security: Type Validation
    // Note: mime type check is not foolproof but a good first line of defense
    // We allow anything starting with audio/ OR if the extension looks like audio (fallback for some OS/browser combos)
    const isAudioType = file.type.startsWith('audio/');
    // Very basic extension check as fallback if type is empty or generic
    const isAudioExtension = /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(file.name);

    if (!isAudioType && !isAudioExtension) {
       setError("Invalid file type. Please upload an audio file.");
       return;
    }

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
        // Dynamic import to split @google/genai from main bundle
        const { analyzeAudio } = await import('./services/geminiService');
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        const target = event.target as HTMLElement;
        if (target.matches('input, textarea, button, a, [role="button"]')) return;

        event.preventDefault();
        if (audioUrl) {
            togglePlayback();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, audioUrl]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-20">
      {/* Header */}
      <header className="w-full border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
              <AudioLines className="w-6 h-6 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 uppercase">Sonic Architect</h1>
              <p className="text-[10px] text-zinc-500 mono tracking-widest uppercase">Ableton Live 12 Deconstructor v1.0</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-md transition-all border border-zinc-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none"
              aria-label="Import audio stem"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
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

      {!hasApiKey && (
        <div className="w-full max-w-6xl px-6 mt-4" role="alert">
          <div className="p-4 bg-amber-900/30 border border-amber-700/50 rounded-lg flex items-center gap-3 text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
            <p className="text-sm">
              Missing API key. Set <code className="bg-amber-900/50 px-1 rounded mono text-xs">GEMINI_API_KEY</code> in <code className="bg-amber-900/50 px-1 rounded mono text-xs">.env.local</code> to analyze audio.
            </p>
          </div>
        </div>
      )}

      <main className="max-w-6xl w-full px-6 mt-8 space-y-8">
        {/* Playback & Visualization */}
        <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-800 rounded-full">
                <Music2 className="w-5 h-5 text-blue-400" aria-hidden="true" />
              </div>
              <span className="text-sm font-medium text-zinc-300 mono">{fileName || 'Awaiting Input...'}</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlayback}
                disabled={!audioUrl}
                className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-full text-white transition-all transform active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none group relative"
                aria-label={isPlaying ? "Pause playback" : "Start playback"}
                aria-keyshortcuts="Space"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" aria-hidden="true" /> : <Play className="w-6 h-6 fill-current ml-1" aria-hidden="true" />}
              </button>
            </div>
          </div>
          
          <React.Suspense fallback={<WaveformSkeleton />}>
            <WaveformVisualizer audioUrl={audioUrl} isPlaying={isPlaying} />
          </React.Suspense>
          
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
              <Activity className="w-5 h-5 text-blue-400 animate-spin" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-blue-200">Neural Engine Analyzing Spectrogram...</span>
                <span className="text-xs text-blue-400/80">Identifying transients, frequency domains, and device chains...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg flex items-center gap-3 text-red-200">
              <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
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
              <Upload className="w-8 h-8 text-zinc-600" aria-hidden="true" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Ready to Deconstruct</h2>
              <p className="text-zinc-500 text-sm">Upload an audio file to generate a complete Ableton Live 12 reconstruction blueprint. Our neural engine will map out every device and signal path.</p>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full transition-all shadow-lg shadow-blue-500/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none"
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
