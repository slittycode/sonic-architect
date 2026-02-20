export interface GlobalTelemetry {
  bpm: string;
  key: string;
  groove: string;
  bpmConfidence?: number;
  keyConfidence?: number;
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

export interface ChordSegment {
  /** Time range string, e.g. "0:04–0:08" */
  timeRange: string;
  /** Chord symbol, e.g. "Am", "Fmaj7" */
  chord: string;
  /** Root note name */
  root: string;
  /** Chord quality (Major, Minor, etc.) */
  quality: string;
  /** Detection confidence 0-1 */
  confidence: number;
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

export interface ReconstructionBlueprint {
  telemetry: GlobalTelemetry;
  arrangement: ArrangementSection[];
  chordProgression?: ChordSegment[];
  chordProgressionSummary?: string;
  instrumentation: InstrumentRackElement[];
  fxChain: FXChainItem[];
  secretSauce: SecretSauce;
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
export type ProviderType = 'local' | 'ollama' | 'gemini';

export interface AnalysisProvider {
  name: string;
  type: ProviderType;
  analyze(file: File): Promise<ReconstructionBlueprint>;
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
}

export interface SpectralBandEnergy {
  name: string;
  rangeHz: [number, number];
  averageDb: number;
  peakDb: number;
  dominance: 'dominant' | 'present' | 'weak' | 'absent';
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
