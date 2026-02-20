/**
 * First-time user tracking utilities
 * Manages localStorage state for hero display persistence
 */

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

/**
 * Get first-time user state from localStorage
 * Falls back to in-memory default if localStorage unavailable
 */
export function getFirstTimeUserState(): FirstTimeUserState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    
    const parsed = JSON.parse(stored);
    return {
      hasCompletedAnalysis: parsed.hasCompletedAnalysis ?? false,
      firstAnalysisDate: parsed.firstAnalysisDate ?? null,
      analysisCount: parsed.analysisCount ?? 0,
    };
  } catch (error) {
    console.warn('localStorage unavailable, using in-memory state:', error);
    return DEFAULT_STATE;
  }
}

/**
 * Save first-time user state to localStorage
 * Handles QuotaExceededError gracefully
 */
export function setFirstTimeUserState(state: FirstTimeUserState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, state not persisted');
    } else {
      console.warn('Failed to save first-time user state:', error);
    }
  }
}

/**
 * Mark that the user has completed their first analysis
 * Updates localStorage with completion timestamp
 */
export function markAnalysisComplete(): void {
  const currentState = getFirstTimeUserState();
  const newState: FirstTimeUserState = {
    hasCompletedAnalysis: true,
    firstAnalysisDate: currentState.firstAnalysisDate || new Date().toISOString(),
    analysisCount: currentState.analysisCount + 1,
  };
  setFirstTimeUserState(newState);
}
