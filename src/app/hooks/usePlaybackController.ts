import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePlaybackControllerArgs {
  audioUrl: string | null;
  waveformDuration: number;
  onPlaybackError: (message: string) => void;
}

export function usePlaybackController({
  audioUrl,
  waveformDuration,
  onPlaybackError,
}: UsePlaybackControllerArgs) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    audioRef.current
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => onPlaybackError('Unable to start playback.'));
  }, [isPlaying, onPlaybackError]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, button, a, [role="button"]')) return;

      event.preventDefault();
      if (audioUrl) togglePlayback();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioUrl, togglePlayback]);

  const handleSeek = useCallback(
    (time: number) => {
      if (!audioRef.current || !Number.isFinite(time)) return;
      audioRef.current.currentTime = time;
      const duration = audioRef.current.duration || waveformDuration;
      if (duration > 0) setPlaybackProgress(time / duration);
    },
    [waveformDuration]
  );

  const handleTimeUpdate = useCallback(() => {
    const node = audioRef.current;
    if (!node || !node.duration) return;
    setPlaybackProgress(node.currentTime / node.duration);
  }, []);

  const handlePlaybackEnded = useCallback(() => {
    setIsPlaying(false);
    setPlaybackProgress(1);
  }, []);

  const resetPlayback = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlaying(false);
    setPlaybackProgress(0);
  }, []);

  return {
    audioRef,
    isPlaying,
    setIsPlaying,
    playbackProgress,
    setPlaybackProgress,
    togglePlayback,
    handleSeek,
    handleTimeUpdate,
    handlePlaybackEnded,
    resetPlayback,
  };
}
