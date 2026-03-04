import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload } from 'lucide-react';
import { AnalysisStatus, type AnalysisProvider } from '@/src/domain/providers/types';
import type { ReconstructionBlueprint } from '@/src/domain/blueprint/types';
import type { PitchDetectionResult } from '@/src/domain/audio/types';
import { GEMINI_MODEL_LABELS } from '@/services/providers/gemini/client';
import BlueprintDisplay from '@/components/BlueprintDisplay';
import SessionMusician from '@/components/SessionMusician';
import ChatPanel from '@/components/ChatPanel';
import { LocalAnalysisProvider } from '@/services/localProvider';
import { decodeAudioFile, extractWaveformPeaks } from '@/services/audioAnalysis';
import { detectPitches } from '@/services/pitchDetection';
import { detectPolyphonic } from '@/services/polyphonicPitch';
import { downloadJson, downloadMarkdown } from '@/services/exportBlueprint';
import AppHeader from '@/src/app/components/AppHeader';
import PlaybackPanel from '@/src/app/components/PlaybackPanel';
import { useAnalysisController } from '@/src/app/hooks/useAnalysisController';
import { useProviderSettings } from '@/src/app/hooks/useProviderSettings';
import { usePlaybackController } from '@/src/app/hooks/usePlaybackController';
const localProvider = new LocalAnalysisProvider();
function getErrorName(error: unknown): string | null {
  if (error instanceof Error) return error.name;
  if (typeof error === 'object' && error !== null && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === 'string' ? name : null;
  }
  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

const App: React.FC = () => {
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [blueprint, setBlueprint] = useState<ReconstructionBlueprint | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
  const [waveformDuration, setWaveformDuration] = useState(0);

  // Session Musician state
  const [midiResult, setMidiResult] = useState<PitchDetectionResult | null>(null);
  const [midiDetecting, setMidiDetecting] = useState(false);
  const [midiError, setMidiError] = useState<string | null>(null);
  const [polyMode] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const {
    providerType,
    showSettings,
    setShowSettings,
    providerNotice,
    setProviderNotice,
    geminiModel,
    handleProviderChange,
    handleGeminiModelChange,
  } = useProviderSettings();

  const {
    audioRef,
    isPlaying,
    playbackProgress,
    setPlaybackProgress,
    togglePlayback,
    handleSeek,
    handleTimeUpdate,
    handlePlaybackEnded,
    resetPlayback,
  } = usePlaybackController({
    audioUrl,
    waveformDuration,
    onPlaybackError: (message) => setError(message),
  });
  const { validateUpload, isLargeUpload } = useAnalysisController();

  const replaceAudioUrl = useCallback((nextUrl: string | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = nextUrl;
    setAudioUrl(nextUrl);
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const getActiveProvider = useCallback(async (): Promise<AnalysisProvider> => {
    setProviderNotice(null);

    if (providerType === 'gemini') {
      // Lazy load Gemini provider only when selected
      const { GeminiProvider } = await import('@/services/providers/gemini/provider');
      const gemini = new GeminiProvider(geminiModel);
      if (await gemini.isAvailable()) return gemini;
      // Fallback to local if Gemini API key is missing
      setProviderNotice('Gemini API key not found. Using Local DSP Engine.');
    }

    return localProvider;
  }, [providerType, geminiModel, setProviderNotice]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    const validationError = validateUpload(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isLargeUpload(file)) {
      console.info('Large file detected — analysis may take longer.');
    }

    setFileName(file.name);
    setLastFile(file);
    setPlaybackProgress(0);
    setWaveformPeaks(null);
    setWaveformDuration(0);
    const url = URL.createObjectURL(file);
    replaceAudioUrl(url);

    await triggerAnalysis(file);
  };

  const triggerAnalysis = async (file: File) => {
    setStatus(AnalysisStatus.ANALYZING);
    setError(null);
    setProgressMessage('');
    setMidiResult(null);
    setMidiError(null);
    abortRef.current = new AbortController();

    let decodedBuffer: AudioBuffer | null = null;
    try {
      decodedBuffer = await decodeAudioFile(file);
      setWaveformPeaks(extractWaveformPeaks(decodedBuffer));
      setWaveformDuration(decodedBuffer.duration);
    } catch (decodeError: unknown) {
      if (providerType !== 'gemini') {
        setStatus(AnalysisStatus.ERROR);
        setError(getErrorMessage(decodeError, 'Could not decode audio for local analysis.'));
        return;
      }
      setWaveformPeaks(null);
      setWaveformDuration(0);
      setMidiError('Local decode failed. Session Musician is unavailable for this file.');
    }

    // Run blueprint analysis and pitch detection concurrently
    const blueprintPromise = (async () => {
      try {
        const provider = await getActiveProvider();
        const maybeBufferProvider = provider as AnalysisProvider & {
          analyzeAudioBuffer?: (
            audioBuffer: AudioBuffer,
            signal?: AbortSignal
          ) => Promise<ReconstructionBlueprint>;
        };
        if (decodedBuffer && typeof maybeBufferProvider.analyzeAudioBuffer === 'function') {
          setProgressMessage('Decoding audio...');
        }
        const result =
          decodedBuffer && typeof maybeBufferProvider.analyzeAudioBuffer === 'function'
            ? await maybeBufferProvider.analyzeAudioBuffer(decodedBuffer, abortRef.current?.signal)
            : await provider.analyze(file, abortRef.current?.signal, setProgressMessage);
        setBlueprint(result);
        setStatus(AnalysisStatus.COMPLETED);
        return result;
      } catch (err: unknown) {
        const errorName = getErrorName(err);
        if (errorName === 'AbortError') {
          setStatus(AnalysisStatus.IDLE);
          setProgressMessage('');
          setError(null);
          return null;
        }
        console.error(err);
        setError(getErrorMessage(err, 'An unexpected error occurred during analysis.'));
        setStatus(AnalysisStatus.ERROR);
        return null;
      }
    })();

    const pitchPromise = (async () => {
      if (!decodedBuffer) return;
      try {
        setMidiDetecting(true);
        // Use BPM from blueprint if available, otherwise default
        const bpResult = await blueprintPromise;
        const bpm = bpResult?.telemetry?.bpm ? parseFloat(bpResult.telemetry.bpm) || 120 : 120;
        const pitchResult = polyMode
          ? await detectPolyphonic(decodedBuffer, bpm)
          : await detectPitches(decodedBuffer, bpm);
        setMidiResult(pitchResult);
      } catch (err: unknown) {
        console.error('Pitch detection error:', err);
        setMidiError(getErrorMessage(err, 'Pitch detection failed.'));
      } finally {
        setMidiDetecting(false);
      }
    })();

    await Promise.allSettled([blueprintPromise, pitchPromise]);
  };

  const resetAll = () => {
    setStatus(AnalysisStatus.IDLE);
    setBlueprint(null);
    replaceAudioUrl(null);
    resetPlayback();
    setError(null);
    setFileName(null);
    setLastFile(null);
    setProviderNotice(null);
    setWaveformPeaks(null);
    setWaveformDuration(0);
    setPlaybackProgress(0);
    setMidiResult(null);
    setMidiDetecting(false);
    setMidiError(null);
    abortRef.current?.abort();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const geminiLabel = GEMINI_MODEL_LABELS[geminiModel];
  const providerLabel = providerType === 'gemini' ? geminiLabel : 'Local DSP Engine';

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center pb-20">
      <AppHeader
        providerType={providerType}
        providerLabel={providerLabel}
        geminiLabel={geminiLabel}
        geminiModel={geminiModel}
        showSettings={showSettings}
        showChat={showChat}
        status={status}
        fileInputRef={fileInputRef}
        onToggleSettings={() => setShowSettings(!showSettings)}
        onProviderChange={handleProviderChange}
        onGeminiModelChange={handleGeminiModelChange}
        onToggleChat={() => setShowChat(!showChat)}
        onFileUpload={handleFileUpload}
      />

      <main className="max-w-[1400px] w-full px-6 mt-8 space-y-8">
        <PlaybackPanel
          audioUrl={audioUrl}
          fileName={fileName}
          isPlaying={isPlaying}
          playbackProgress={playbackProgress}
          waveformPeaks={waveformPeaks}
          waveformDuration={waveformDuration}
          status={status}
          progressMessage={progressMessage}
          providerType={providerType}
          geminiLabel={geminiLabel}
          providerNotice={providerNotice}
          error={error}
          lastFile={lastFile}
          audioRef={audioRef}
          onTogglePlayback={togglePlayback}
          onSeek={handleSeek}
          onTimeUpdate={handleTimeUpdate}
          onPlaybackEnded={handlePlaybackEnded}
          onCancel={() => abortRef.current?.abort()}
          onDismissError={() => setError(null)}
          onRetry={triggerAnalysis}
          onResetAll={resetAll}
        />

        {blueprint && status === AnalysisStatus.COMPLETED && (
          <>
            {/* Analysis metadata bar */}
            {blueprint.meta && (
              <div className="flex items-center gap-4 text-[10px] mono text-zinc-500 uppercase tracking-widest px-1">
                <span>
                  Engine:{' '}
                  {blueprint.meta.provider === 'gemini'
                    ? `${geminiLabel} + Local DSP`
                    : 'Local DSP'}
                </span>
                <span className="text-zinc-700">|</span>
                <span>Analyzed in {blueprint.meta.analysisTime}ms</span>
                {blueprint.meta.sampleRate > 0 && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span>
                      {blueprint.meta.sampleRate / 1000}kHz / {blueprint.meta.channels}ch
                    </span>
                  </>
                )}
                {blueprint.meta.duration > 0 && (
                  <>
                    <span className="text-zinc-700">|</span>
                    <span>
                      {Math.floor(blueprint.meta.duration / 60)}:
                      {Math.floor(blueprint.meta.duration % 60)
                        .toString()
                        .padStart(2, '0')}
                    </span>
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

            <div className="flex gap-2 justify-end -mt-2 mb-2">
              <button
                onClick={() => downloadJson(blueprint!, fileName || 'stem')}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md transition-all border border-zinc-700"
              >
                Export JSON
              </button>
              <button
                onClick={() => downloadMarkdown(blueprint!, fileName || 'stem')}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md transition-all border border-zinc-700"
              >
                Export MD
              </button>
            </div>
            <BlueprintDisplay blueprint={blueprint} />
          </>
        )}

        {/* Session Musician — renders when detection is running or has results */}
        {(midiDetecting || midiResult || midiError) && (
          <SessionMusician
            result={midiResult}
            detecting={midiDetecting}
            error={midiError}
            fileName={fileName}
          />
        )}

        {/* Chat Panel — renders when toggled */}
        {showChat && <ChatPanel blueprint={blueprint} providerType={providerType} />}

        {!blueprint && status === AnalysisStatus.IDLE && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div className="w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-xl">
              <Upload className="w-8 h-8 text-zinc-600" aria-hidden="true" />
            </div>
            <div className="max-w-md">
              <h2 className="text-xl font-bold text-zinc-200 mb-2">Ready to Deconstruct</h2>
              <p className="text-zinc-500 text-sm">
                Upload an audio file to generate a complete Ableton Live 12 reconstruction
                blueprint.
                {providerType === 'gemini'
                  ? ` Local DSP measures BPM, key, and spectrum precisely — ${geminiLabel} enriches descriptions and Ableton device recommendations.`
                  : ' Analysis runs entirely in your browser — no API key needed.'}
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
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between text-[10px] mono text-zinc-600 uppercase tracking-widest">
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
