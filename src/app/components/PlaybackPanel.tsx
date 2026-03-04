import React from 'react';
import { Activity, AlertCircle, Music2, Pause, Play } from 'lucide-react';
import { AnalysisStatus, type ProviderType } from '@/src/domain/providers/types';
import WaveformSkeleton from '@/components/WaveformSkeleton';

const WaveformVisualizer = React.lazy(() => import('@/components/WaveformVisualizer'));

interface PlaybackPanelProps {
  audioUrl: string | null;
  fileName: string | null;
  isPlaying: boolean;
  playbackProgress: number;
  waveformPeaks: number[] | null;
  waveformDuration: number;
  status: AnalysisStatus;
  progressMessage: string;
  providerType: ProviderType;
  geminiLabel: string;
  providerNotice: string | null;
  error: string | null;
  lastFile: File | null;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onTogglePlayback: () => void;
  onSeek: (time: number) => void;
  onTimeUpdate: () => void;
  onPlaybackEnded: () => void;
  onCancel: () => void;
  onDismissError: () => void;
  onRetry: (file: File) => void;
  onResetAll: () => void;
}

export default function PlaybackPanel({
  audioUrl,
  fileName,
  isPlaying,
  playbackProgress,
  waveformPeaks,
  waveformDuration,
  status,
  progressMessage,
  providerType,
  geminiLabel,
  providerNotice,
  error,
  lastFile,
  audioRef,
  onTogglePlayback,
  onSeek,
  onTimeUpdate,
  onPlaybackEnded,
  onCancel,
  onDismissError,
  onRetry,
  onResetAll,
}: PlaybackPanelProps): React.JSX.Element {
  return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-full">
            <Music2 className="w-5 h-5 text-blue-400" aria-hidden="true" />
          </div>
          <span className="text-sm font-medium text-zinc-300 mono">
            {fileName || 'Awaiting Input...'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onTogglePlayback}
            disabled={!audioUrl}
            className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-full text-white transition-all transform active:scale-95 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none group relative"
            aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
            aria-keyshortcuts="Space"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-current" aria-hidden="true" />
            ) : (
              <Play className="w-6 h-6 fill-current ml-1" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <React.Suspense fallback={<WaveformSkeleton />}>
        <WaveformVisualizer
          audioUrl={audioUrl}
          peaks={waveformPeaks}
          duration={waveformDuration}
          playbackProgress={playbackProgress}
          onSeek={onSeek}
        />
      </React.Suspense>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={onTimeUpdate}
          onEnded={onPlaybackEnded}
          className="hidden"
        />
      )}

      {status === AnalysisStatus.ANALYZING && (
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-4">
            <Activity className="w-5 h-5 text-blue-400 animate-spin" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-blue-200">
                {progressMessage ||
                  (providerType === 'gemini'
                    ? `Running Local DSP + ${geminiLabel} Enrichment...`
                    : 'Analyzing Audio Spectrogram...')}
              </span>
              <span className="text-xs text-blue-400/80">
                {providerType === 'gemini'
                  ? 'Two-phase analysis: audio + DSP hints → Gemini...'
                  : 'Extracting BPM, key, spectral features, chords, and onset data...'}
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-200 text-sm font-medium rounded-md transition-colors border border-red-800/50 flex-shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {providerNotice && (
        <div className="mt-4 p-3 bg-amber-900/20 border border-amber-700/50 rounded text-xs text-amber-200">
          {providerNotice}
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
              onClick={onDismissError}
              className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
            >
              Dismiss
            </button>
            {lastFile && (
              <button
                onClick={() => onRetry(lastFile)}
                className="text-xs px-3 py-1.5 bg-blue-800 text-blue-200 rounded hover:bg-blue-700 transition-colors"
              >
                Retry Analysis
              </button>
            )}
            <button
              onClick={onResetAll}
              className="text-xs px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
