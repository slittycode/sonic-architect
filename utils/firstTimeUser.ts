export interface FirstTimeUserState {
  hasCompletedAnalysis: boolean;
  firstAnalysisDate: string | null;
  analysisCount: number;
}

const STORAGE_KEY = 'sonic-architect-first-time';

const DEFAULT_STATE: FirstTimeUserState = {
  hasCompletedAnalysis: false,
  firstAnalysisDate: null,
  analysisCount: 0,
};

function normalizeState(value: unknown): FirstTimeUserState {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_STATE };
  }

  const candidate = value as Partial<FirstTimeUserState>;

  return {
    hasCompletedAnalysis: candidate.hasCompletedAnalysis === true,
    firstAnalysisDate:
      typeof candidate.firstAnalysisDate === 'string' ? candidate.firstAnalysisDate : null,
    analysisCount:
      typeof candidate.analysisCount === 'number' && Number.isFinite(candidate.analysisCount)
        ? candidate.analysisCount
        : 0,
  };
}

export function getFirstTimeUserState(): FirstTimeUserState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { ...DEFAULT_STATE };
    }

    return normalizeState(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function setFirstTimeUserState(state: FirstTimeUserState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    // Silently ignore persistence failures (private browsing, quota, etc.).
  }
}

export function markAnalysisComplete(): void {
  const previousState = getFirstTimeUserState();

  setFirstTimeUserState({
    hasCompletedAnalysis: true,
    firstAnalysisDate: previousState.firstAnalysisDate ?? new Date().toISOString(),
    analysisCount: previousState.analysisCount + 1,
  });
}
