
export interface GlobalTelemetry {
  bpm: string;
  key: string;
  groove: string;
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

export interface ReconstructionBlueprint {
  telemetry: GlobalTelemetry;
  arrangement: ArrangementSection[];
  instrumentation: InstrumentRackElement[];
  fxChain: FXChainItem[];
  secretSauce: SecretSauce;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
