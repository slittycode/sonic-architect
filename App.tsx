
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  AudioLines, 
  Upload, 
  Play, 
  Pause, 
  Music2, 
  AlertCircle,
  Activity,
  Settings,
  Cpu,
  Cloud,
} from 'lucide-react';
import { AnalysisStatus, AnalysisProvider, ProviderType, ReconstructionBlueprint } from './types';
import BlueprintDisplay from './components/BlueprintDisplay';
import WaveformSkeleton from './components/WaveformSkeleton';
import { LocalAnalysisProvider } from './services/localProvider';

const WaveformVisualizer = React.lazy(() => import('./components/WaveformVisualizer'));

// Initialize providers
const localProvider = new LocalAnalysisProvider();

function getStoredProvider(): ProviderType {
  try {
    const stored = localStorage.getItem('sonic-architect-provider');
    if (stored === 'gemini' || stored === 'local') return stored;
  } catch {}
  return 'local';
}

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [blueprint, setBlueprint] = useState<ReconstructionBlueprint | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [providerType, setProviderType] = useState<ProviderType>(getStoredProvider);
  const [showSettings, setShowSettings] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (local analysis can handle larger files)
  const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;

  const handleProviderChange = (type: ProviderType) => {
    setProviderType(type);
    try { localStorage.setItem('sonic-architect-provider', type); } catch {}
    setShowSettings(false);
  };

  const getActiveProvider = useCallback(async (): Promise<AnalysisProvider> => {
    if (providerType === 'gemini') {
      // Lazy load Gemini provider only when selected
      const { GeminiProvider } = await import('./services/geminiService');
      const gemini = new GeminiProvider();
      if (await gemini.isAvailable()) return gemini;
      // Fallback to local if Gemini API key is missing
      console.warn('Gemini API key not found. Falling back to local analysis.');
    }
    return localProvider;
  }, [providerType]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds limit (${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB). Please upload a smaller stem.`);
      return;
    }

    const isAudioType = file.type.startsWith('audio/');
    const isAudioExtension = /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(file.name);

    if (!isAudioType && !isAudioExtension) {
       setError("Invalid file type. Please upload an audio file.");
       return;
    }

    if (file.size > LARGE_FILE_THRESHOLD) {
      console.info('Large file detected — analysis may take longer.');
    }

    setFileName(file.name);
    setLastFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    await triggerAnalysis(file);
  };

  const triggerAnalysis = async (file: File) => {
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    try {
      const provider = await getActiveProvider();
      const result = await provider.analyze(file);
      setBlueprint(result);
      setStatus(AnalysisStatus.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const resetAll = () => {
    setStatus(AnalysisStatus.IDLE);
    setBlueprint(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setError(null);
    setFileName(null);
    setLastFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePlayback = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

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

  const providerLabel = providerType === 'gemini' ? 'Gemini 1.5 Pro' : 'Local DSP Engine';

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
              <p className="text-[10px] text-zinc-500 mono tracking-widest uppercase">Ableton Live 12 Deconstructor v2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Provider selector */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 text-xs rounded-md transition-all border border-zinc-700/50 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
                aria-label="Analysis engine settings"
                title="Analysis engine settings"
              >
                <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">{providerLabel}</span>
              </button>
              {showSettings && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Analysis Engine</p>
                  </div>
                  <button
                    onClick={() => handleProviderChange('local')}
                    className={`w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/50 transition-colors ${providerType === 'local' ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''}`}
                  >
                    <Cpu className="w-4 h-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Local DSP Engine</p>
                      <p className="text-[10px] text-zinc-500">Client-side analysis. No API key needed. Works offline.</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleProviderChange('gemini')}
                    className={`w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/50 transition-colors ${providerType === 'gemini' ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''}`}
                  >
                    <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium text-zinc-200">Gemini 1.5 Pro</p>
                      <p className="text-[10px] text-zinc-500">Cloud AI analysis. Requires API key in .env.local.</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={status === AnalysisStatus.ANALYZING}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 text-sm font-medium rounded-md transition-all border border-zinc-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none"
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
                <span className="text-sm font-semibold text-blue-200">
                  {providerType === 'local' ? 'Analyzing Audio Spectrogram...' : 'Neural Engine Analyzing Spectrogram...'}
                </span>
                <span className="text-xs text-blue-400/80">
                  {providerType === 'local'
                    ? 'Extracting BPM, key, spectral features, and onset data...'
                    : 'Identifying transients, frequency domains, and device chains...'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-800/50 rounded-lg">
              <div className="flex items-center gap-3 text-red-200">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" aria-hidden="true" />
                <span className="text-sm flex-1">{error}</span>
              </div>
              <div className="flex gap-2 mt-3 ml-8">
                <button
                  onClick={() => setError(null)}
                  className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
                >
                  Dismiss
                </button>
                {lastFile && (
                  <button
                    onClick={() => triggerAnalysis(lastFile)}
                    className="text-xs px-3 py-1.5 bg-blue-800 text-blue-200 rounded hover:bg-blue-700 transition-colors"
                  >
                    Retry Analysis
                  </button>
                )}
                <button
                  onClick={resetAll}
                  className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </section>

        {blueprint && status === AnalysisStatus.COMPLETED && (
          <>
            {/* Analysis metadata bar */}
            {blueprint.meta && (
              <div className="flex items-center gap-4 text-[10px] mono text-zinc-500 uppercase tracking-widest px-1">
                <span>Engine: {blueprint.meta.provider === 'local' ? 'Local DSP' : 'Gemini 1.5 Pro'}</span>
                <span className="text-zinc-700">|</span>
                <span>Analyzed in {blueprint.meta.analysisTime}ms</span>
                {blueprint.meta.sampleRate > 0 && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span>{blueprint.meta.sampleRate / 1000}kHz / {blueprint.meta.channels}ch</span>
                  </>
                )}
                {blueprint.meta.duration > 0 && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span>{Math.floor(blueprint.meta.duration / 60)}:{Math.floor(blueprint.meta.duration % 60).toString().padStart(2, '0')}</span>
                  </>
                )}
                {blueprint.telemetry.bpmConfidence != null && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span>BPM conf: {Math.round(blueprint.telemetry.bpmConfidence * 100)}%</span>
                  </>
                )}
                {blueprint.telemetry.keyConfidence != null && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span>Key conf: {Math.round(blueprint.telemetry.keyConfidence * 100)}%</span>
                  </>
                )}
              </div>
            )}
            <BlueprintDisplay blueprint={blueprint} />
          </>
        )}

        {!blueprint && status === AnalysisStatus.IDLE && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-xl">
              <Upload className="w-8 h-8 text-zinc-600" aria-hidden="true" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Ready to Deconstruct</h2>
              <p className="text-zinc-500 text-sm">
                Upload an audio file to generate a complete Ableton Live 12 reconstruction blueprint.
                {providerType === 'local'
                  ? ' Analysis runs locally in your browser — no API key needed.'
                  : ' Our neural engine will map out every device and signal path.'}
              </p>
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
          <span className="hidden sm:inline">Active Engine: {providerLabel}</span>
          <span>© 2025 Sonic Architect</span>
        </div>
      </footer>

      {/* Click outside to close settings */}
      {showSettings && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
      )}
    </div>
  );
};

export default App;
