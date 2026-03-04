const MAX_FILE_SIZE = 100 * 1024 * 1024;
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;

export function useAnalysisController() {
  const validateUpload = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds limit (${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB). Please upload a smaller stem.`;
    }

    const isAudioType = file.type.startsWith('audio/');
    const isAudioExtension = /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(file.name);

    if (!isAudioType && !isAudioExtension) {
      return 'Invalid file type. Please upload an audio file (.mp3, .wav, etc.).';
    }

    return null;
  };

  const isLargeUpload = (file: File): boolean => file.size > LARGE_FILE_THRESHOLD;

  return {
    validateUpload,
    isLargeUpload,
    maxFileSizeMb: MAX_FILE_SIZE / 1024 / 1024,
  };
}
