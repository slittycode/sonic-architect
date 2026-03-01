/**
 * Gemini Diagnostic Logger
 *
 * Captures request/response metadata for each Gemini API call and triggers
 * a JSON file download in the browser. Use to compare payloads across model
 * selections and diagnose quality discrepancies.
 *
 * Downloaded files are named:
 *   gemini-diag_<modelId>_<timestamp>.json
 *
 * Toggle via: localStorage.setItem('GEMINI_DIAG', '1')
 * Disable:    localStorage.removeItem('GEMINI_DIAG')
 */

export interface GeminiDiagnosticEntry {
  phase: 'phase1' | 'phase2';
  model: string;
  modelPath: string;
  audioPartType: 'fileData' | 'inlineData';
  audioMimeType: string;
  fileUri?: string;
  promptLength: number;
  promptPreview: string;
  configSent: Record<string, unknown>;
  responseLength: number;
  responseFirst500: string;
  responseLast200: string;
  /** Full raw response text — can be large */
  responseFullText: string;
  durationMs: number;
}

export interface GeminiDiagnosticReport {
  timestamp: string;
  modelId: string;
  modelPath: string;
  audioFileName: string;
  audioFileSizeMB: number;
  totalDurationMs: number;
  phases: GeminiDiagnosticEntry[];
}

let currentReport: GeminiDiagnosticReport | null = null;

/** Returns true when diagnostic logging is enabled via localStorage. */
export function isDiagEnabled(): boolean {
  try {
    return localStorage.getItem('GEMINI_DIAG') === '1';
  } catch {
    return false;
  }
}

export function startDiagnosticReport(
  modelId: string,
  modelPath: string,
  audioFileName: string,
  audioFileSizeBytes: number
): void {
  if (!isDiagEnabled()) return;
  currentReport = {
    timestamp: new Date().toISOString(),
    modelId,
    modelPath,
    audioFileName,
    audioFileSizeMB: Math.round((audioFileSizeBytes / (1024 * 1024)) * 100) / 100,
    totalDurationMs: 0,
    phases: [],
  };
  console.group(`[GeminiDiag] ${modelId}`);
  console.log('Model path:', modelPath);
  console.log('Audio file:', audioFileName, `(${currentReport.audioFileSizeMB} MB)`);
}

export function addDiagnosticEntry(entry: GeminiDiagnosticEntry): void {
  if (!currentReport) return;
  currentReport.phases.push(entry);

  console.log(`[GeminiDiag] ${entry.phase} — ${entry.durationMs}ms, response ${entry.responseLength} chars`);
}

export function finishAndDownloadReport(totalDurationMs: number): void {
  if (!currentReport) return;
  currentReport.totalDurationMs = totalDurationMs;

  const safeModel = currentReport.modelId.replace(/[^a-zA-Z0-9.-]/g, '_');
  const safeTime = currentReport.timestamp.replace(/[:.]/g, '-');
  const filename = `gemini-diag_${safeModel}_${safeTime}.json`;

  const blob = new Blob([JSON.stringify(currentReport, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`[GeminiDiag] Downloaded ${filename} (${(blob.size / 1024).toFixed(1)} KB)`);
  console.groupEnd();
  currentReport = null;
}
