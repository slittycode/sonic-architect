export interface GlobalTelemetry {
  bpm: string;
  key: string;
  groove: string;
  /** Stored Phase 1 response (raw Zod-validated output). */
  geminiPhase1?: import('./services/gemini/types/analysis').GeminiPhase1Response;
  /** Discogs MAEST browser ML classification result. */
  maestAnalysis?: {
    topLabels: Array<{ label: string; score: number }>;
    primaryFamily: string;
    primarySubgenre: string;
    topScore: number;
  };
  bpmConfidence?: number;
  keyConfidence?: number;
  /** Gemini cross-verification notes — present when Gemini provider is used. */
  verificationNotes?: string;
  /** Genre detected by classification or LLM verification. */
  detectedGenre?: string;
  /** Enhanced subgenre (if using expanded classification). */
  enhancedGenre?: string;
  /** Secondary genre candidate from enhanced classification. */
  secondaryGenre?: string | null;
  /** Genre family classification (house, techno, dnb, etc.). */
  genreFamily?: 'house' | 'techno' | 'dnb' | 'ambient' | 'trance' | 'dubstep' | 'breaks' | 'other';
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
  /** Sidechain pump detection results. */
  sidechainAnalysis?: {
    hasSidechain: boolean;
    strength: number;
  };
  /** Bass decay analysis results. */
  bassAnalysis?: {
    decayMs: number;
    type: 'punchy' | 'medium' | 'rolling' | 'sustained';
    transientRatio: number;
  };
  /** Swing/groove detection results. */
  swingAnalysis?: {
    swingPercent: number;
    grooveType: 'straight' | 'slight-swing' | 'heavy-swing' | 'shuffle';
  };
  /** Acid/303 bassline detection results. */
  acidAnalysis?: {
    isAcid: boolean;
    confidence: number;
    resonanceLevel: number;
  };
  /** Reverb tail analysis. */
  reverbAnalysis?: {
    rt60: number;
    isWet: boolean;
    tailEnergyRatio: number;
  };
  /** Kick drum distortion analysis. */
  kickAnalysis?: {
    isDistorted: boolean;
    thd: number;
    harmonicRatio: number;
  };
  /** Supersaw detection (trance/progressive). */
  supersawAnalysis?: {
    isSupersaw: boolean;
    confidence: number;
    voiceCount: number;
  };
  /** Vocal detection. */
  vocalAnalysis?: {
    hasVocals: boolean;
    confidence: number;
    vocalEnergyRatio: number;
  };

  // --- V2 Gemini-mode additions ---

  /** Gemini sonic element breakdown (Gemini mode only). */
  elements?: SonicElement[];
  /** Gemini detected characteristics (Gemini mode only). */
  detectedCharacteristics?: DetectedCharacteristics;
  /** Gemini genre analysis (Gemini mode only). */
  genreAnalysis?: GenreAnalysis;
  /** Groove type label, e.g. "four-on-the-floor", "broken beat". */
  grooveDescription?: string;
  /** Chord progression from Gemini with summary. */
  geminiChordProgression?: {
    chords: Array<{ chord: string; startTime: number; duration: number }>;
    summary: string;
  };
}

// --- V2 New Types ---

export interface LocalDSPHints {
  bpm: number;
  bpmConfidence: number;
  key: string;
  keyConfidence: number;
  spectralBands: SpectralBandEnergy[];
  spectralTimeline: SpectralTimeline;
  rmsEnvelope: number[];
  onsets: number[];
  mfcc: number[][];
  chordProgression: ChordSegment[];
  essentiaFeatures?: {
    dissonance?: number;
    hfc?: number;
    spectralComplexity?: number;
    zeroCrossingRate?: number;
  };
  lufsIntegrated?: number;
  truePeak?: number;
  stereoCorrelation?: number;
  stereoWidth?: number;
  monoCompatible?: boolean;
  duration: number;
  sampleRate: number;
  channelCount: number;
}

export interface MixFeedback {
  overallAssessment: string;
  spectralBalance: string;
  stereoField: string;
  dynamics: string;
  lowEnd: string;
  highEnd: string;
  suggestions: string[];
}

export interface SonicElement {
  name: string;
  frequencyRange: string;
  sonicCharacter: string;
  howToRecreate: string;
  suggestedDevices: string[];
  role: string;
}

export interface DetectedCharacteristics {
  sidechain?: { present: boolean; description: string; strength?: string };
  acidResonance?: { present: boolean; description: string };
  reverbCharacter?: { present: boolean; description: string; estimatedDecay?: string };
  distortion?: { present: boolean; description: string; type?: string };
  supersawLayers?: { present: boolean; description: string };
  vocalPresence?: { present: boolean; description: string; type?: string };
  bassCharacter?: { description: string; type?: string };
  groove?: { swingAmount?: string; description: string };
}

export interface GenreAnalysis {
  primary: string;
  secondary: string[];
  confidence: number;
  reasoning: string;
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
  llmEnhanced?: boolean;
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

  // --- V2 Gemini-mode additions ---

  /** Gemini-powered mix feedback prose (Gemini mode only). */
  mixFeedback?: MixFeedback;
  /** Raw Gemini Phase 1 response for debugging/export. */
  geminiPhase1?: object;
  /** Raw Gemini Phase 2 response for debugging/export. */
  geminiPhase2?: object;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

// Provider types
export type ProviderType = 'local' | 'gemini';

export interface AnalysisProvider {
  name: string;
  type: ProviderType;
  analyze(
    file: File,
    signal?: AbortSignal,
    onProgress?: (message: string) => void
  ): Promise<ReconstructionBlueprint>;
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
  /** Peak-to-Loudness Ratio in dB (TruePeak − LUFS_integrated). Higher = more dynamic. Set when both loudness values are available. */
  plr?: number;
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
  /** Essentia.js: harmonic roughness/dissonance 0-1 (acid/industrial detection) */
  dissonance?: number;
  /** Essentia.js: high frequency content (hi-hat/cymbal energy proxy) */
  hfc?: number;
  /** Essentia.js: spectral complexity — number of spectral peaks */
  spectralComplexity?: number;
  /** Essentia.js: zero crossing rate (noise/percussion content) */
  zeroCrossingRate?: number;
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
  /** Pitch bend values (semitones from MIDI note) per Basic Pitch analysis frame.
   *  Populated only when detected with @spotify/basic-pitch. */
  pitchBend?: number[];
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
  /** Expected PLR range in dB (TruePeak − LUFS_integrated). Replaces crest factor for compression assessment. */
  targetPlrRange?: [number, number];
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
    actualPlr?: number;
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
