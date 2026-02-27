export interface GlobalTelemetry {
  bpm: string;
  key: string;
  groove: string;
  bpmConfidence?: number;
  keyConfidence?: number;
  /** Gemini cross-verification notes — present when Gemini provider is used. */
  verificationNotes?: string;
  /** Genre detected by classification or LLM verification. */
  detectedGenre?: string;
  /** True when Gemini overrode the local DSP key estimate. */
  keyCorrectedByGemini?: boolean;
  /** Original local DSP key estimate before Gemini correction. */
  localKeyEstimate?: string;
  /** True when Gemini overrode the local DSP BPM estimate. */
  bpmCorrectedByGemini?: boolean;
  /** Original local DSP BPM estimate before Gemini correction. */
  localBpmEstimate?: string;
  /** Beat positions in seconds from DP beat tracker. For Ableton warp markers. */
  beatPositions?: number[];
  /** Downbeat (bar start) position in seconds. For clip launch alignment. */
  downbeatPosition?: number;
}

export interface ArrangementSection {
  timeRange: string;
  label: string;
  description: string;
}

export interface InstrumentRackElement {
  element: string;
  timbre: string;
  frequency: string;
  abletonDevice: string;
}

export interface FXChainItem {
  artifact: string;
  recommendation: string;
}

export interface SecretSauce {
  trick: string;
  execution: string;
}

export interface AnalysisMeta {
  provider: string;
  analysisTime: number;
  sampleRate: number;
  duration: number;
  channels: number;
}

export interface ChordSegment {
  timeRange: string;
  chord: string;
  root: string;
  quality: string;
  confidence: number;
}

export interface ReconstructionBlueprint {
  telemetry: GlobalTelemetry;
  arrangement: ArrangementSection[];
  instrumentation: InstrumentRackElement[];
  fxChain: FXChainItem[];
  secretSauce: SecretSauce;
  chordProgression?: ChordSegment[];
  chordProgressionSummary?: string;
  patches?: {
    vital?: string;
    operator?: string;
  };
  mixReport?: MixDoctorReport;
  /** Mean MFCC coefficients (13 values) — timbre fingerprint. */
  mfcc?: number[];
  /** Per-band energy over time for spectral timeline visualization. */
  spectralTimeline?: SpectralTimeline;
  meta?: AnalysisMeta;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

// Provider types
export type ProviderType = 'local' | 'ollama' | 'gemini' | 'claude';

export interface AnalysisProvider {
  name: string;
  type: ProviderType;
  analyze(file: File, signal?: AbortSignal): Promise<ReconstructionBlueprint>;
  isAvailable(): Promise<boolean>;
}

// Audio feature extraction types
export interface AudioFeatures {
  bpm: number;
  bpmConfidence: number;
  key: { root: string; scale: string; confidence: number };
  spectralCentroidMean: number;
  rmsMean: number;
  rmsProfile: number[]; // energy over time (for arrangement)
  spectralBands: SpectralBandEnergy[];
  crestFactor: number; // peak-to-RMS ratio (compression indicator)
  onsetCount: number;
  onsetDensity: number; // onsets per second
  duration: number;
  sampleRate: number;
  channels: number;
  /** ITU-R BS.1770-4 integrated loudness in LUFS. */
  lufsIntegrated?: number;
  /** True peak level in dBTP. */
  truePeak?: number;
  /** L/R phase correlation: -1 (out of phase) to +1 (mono). Only set for stereo. */
  stereoCorrelation?: number;
  /** Stereo width: 0 (mono) to 1 (fully decorrelated). Only set for stereo. */
  stereoWidth?: number;
  /** Whether the mix is mono-compatible (no per-band phase cancellation). */
  monoCompatible?: boolean;
  /** Per-band energy over time for spectral timeline visualization. */
  spectralTimeline?: SpectralTimeline;
  /** Mean MFCC coefficients (13 values) — timbre fingerprint. */
  mfcc?: number[];
}

export interface SpectralBandEnergy {
  name: string;
  rangeHz: [number, number];
  averageDb: number;
  peakDb: number;
  dominance: 'dominant' | 'present' | 'weak' | 'absent';
}

// --- Spectral Timeline (per-band energy over time) ---

export interface SpectralTimelineBand {
  /** Band name, e.g. "Sub Bass", "Mids" */
  name: string;
  /** Energy values in dB at each time point */
  energyDb: number[];
}

export interface SpectralTimeline {
  /** Time positions in seconds, one per column */
  timePoints: number[];
  /** Per-band energy series, one entry per spectral band */
  bands: SpectralTimelineBand[];
}

// --- Session Musician (Audio-to-MIDI) ---

export interface DetectedNote {
  /** MIDI note number (0-127) */
  midi: number;
  /** Note name, e.g. "C4", "F#3" */
  name: string;
  /** Frequency in Hz */
  frequency: number;
  /** Start time in seconds */
  startTime: number;
  /** Duration in seconds */
  duration: number;
  /** Velocity 0-127 */
  velocity: number;
  /** Detection confidence 0-1 */
  confidence: number;
}

export type QuantizeGrid = '1/4' | '1/8' | '1/16' | '1/32' | 'off';

export interface QuantizeOptions {
  grid: QuantizeGrid;
  /** Swing amount 0-100 */
  swing: number;
}

export interface PitchDetectionResult {
  notes: DetectedNote[];
  /** Overall detection confidence */
  confidence: number;
  /** Duration of analyzed audio in seconds */
  duration: number;
  /** Detected BPM (used for quantization grid alignment) */
  bpm: number;
}

export interface SessionMusicianState {
  status: 'idle' | 'detecting' | 'done' | 'error';
  result: PitchDetectionResult | null;
  quantizeOptions: QuantizeOptions;
  error: string | null;
}

// --- Mix Doctor ---

export interface GenreProfile {
  id: string;
  name: string;
  /** Expected dynamics range (crest factor) in dB */
  targetCrestFactorRange: [number, number];
  /** Target average dB profiles for spectral bands */
  spectralTargets: Record<string, { minDb: number; maxDb: number; optimalDb: number }>;
  /** Target integrated loudness range in LUFS (e.g. [-16, -12] for EDM) */
  targetLufsRange?: [number, number];
}

export interface MixAdvice {
  band: string;
  issue: 'too-loud' | 'too-quiet' | 'optimal';
  message: string;
  diffDb: number;
}

export interface MixDoctorReport {
  genre: string;
  targetProfile: GenreProfile;
  advice: MixAdvice[];
  dynamicsAdvice: {
    issue: 'too-compressed' | 'too-dynamic' | 'optimal';
    message: string;
    actualCrest: number;
  };
  loudnessAdvice?: {
    issue: 'too-loud' | 'too-quiet' | 'optimal';
    message: string;
    actualLufs: number;
    truePeak: number;
  };
  stereoAdvice?: {
    correlation: number;
    width: number;
    monoCompatible: boolean;
    message: string;
  };
  overallScore: number; // 0-100 indicating closeness to genre profile
}
