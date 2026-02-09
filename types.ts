
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
  ERROR = 'ERROR'
}

// Provider types
export type ProviderType = 'local' | 'gemini';

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
  rmsProfile: number[];        // energy over time (for arrangement)
  spectralBands: SpectralBandEnergy[];
  crestFactor: number;         // peak-to-RMS ratio (compression indicator)
  onsetCount: number;
  onsetDensity: number;        // onsets per second
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
