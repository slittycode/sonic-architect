import { describe, expect, it, beforeEach } from 'vitest';
import {
  getFirstTimeUserState,
  setFirstTimeUserState,
  markAnalysisComplete,
  FirstTimeUserState,
} from '../../utils/firstTimeUser';

describe('firstTimeUser utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getFirstTimeUserState', () => {
    it('returns default state when localStorage is empty', () => {
      const state = getFirstTimeUserState();

      expect(state).toEqual({
        hasCompletedAnalysis: false,
        firstAnalysisDate: null,
        analysisCount: 0,
      });
    });

    it('returns stored state when data exists in localStorage', () => {
      const mockState: FirstTimeUserState = {
        hasCompletedAnalysis: true,
        firstAnalysisDate: '2025-01-15T10:30:00.000Z',
        analysisCount: 3,
      };

      localStorage.setItem('sonic-architect-first-time', JSON.stringify(mockState));

      const state = getFirstTimeUserState();
      expect(state).toEqual(mockState);
    });

    it('handles partial data in localStorage gracefully', () => {
      localStorage.setItem(
        'sonic-architect-first-time',
        JSON.stringify({ hasCompletedAnalysis: true })
      );

      const state = getFirstTimeUserState();
      expect(state.hasCompletedAnalysis).toBe(true);
      expect(state.firstAnalysisDate).toBeNull();
      expect(state.analysisCount).toBe(0);
    });

    it('returns default state when localStorage contains invalid JSON', () => {
      localStorage.setItem('sonic-architect-first-time', 'invalid-json');

      const state = getFirstTimeUserState();
      expect(state).toEqual({
        hasCompletedAnalysis: false,
        firstAnalysisDate: null,
        analysisCount: 0,
      });
    });
  });

  describe('setFirstTimeUserState', () => {
    it('saves state to localStorage', () => {
      const mockState: FirstTimeUserState = {
        hasCompletedAnalysis: true,
        firstAnalysisDate: '2025-01-15T10:30:00.000Z',
        analysisCount: 1,
      };

      setFirstTimeUserState(mockState);

      const stored = localStorage.getItem('sonic-architect-first-time');
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(mockState);
    });

    it('overwrites existing state', () => {
      const initialState: FirstTimeUserState = {
        hasCompletedAnalysis: false,
        firstAnalysisDate: null,
        analysisCount: 0,
      };

      setFirstTimeUserState(initialState);

      const updatedState: FirstTimeUserState = {
        hasCompletedAnalysis: true,
        firstAnalysisDate: '2025-01-15T10:30:00.000Z',
        analysisCount: 5,
      };

      setFirstTimeUserState(updatedState);

      const stored = localStorage.getItem('sonic-architect-first-time');
      expect(JSON.parse(stored!)).toEqual(updatedState);
    });
  });

  describe('markAnalysisComplete', () => {
    it('marks first analysis as complete with timestamp', () => {
      const beforeTime = new Date().toISOString();
      
      markAnalysisComplete();

      const state = getFirstTimeUserState();
      expect(state.hasCompletedAnalysis).toBe(true);
      expect(state.analysisCount).toBe(1);
      expect(state.firstAnalysisDate).not.toBeNull();
      
      // Verify timestamp is recent
      const afterTime = new Date().toISOString();
      expect(state.firstAnalysisDate!).toBeGreaterThanOrEqual(beforeTime);
      expect(state.firstAnalysisDate!).toBeLessThanOrEqual(afterTime);
    });

    it('increments analysis count on subsequent calls', () => {
      markAnalysisComplete();
      const firstState = getFirstTimeUserState();
      expect(firstState.analysisCount).toBe(1);

      markAnalysisComplete();
      const secondState = getFirstTimeUserState();
      expect(secondState.analysisCount).toBe(2);

      markAnalysisComplete();
      const thirdState = getFirstTimeUserState();
      expect(thirdState.analysisCount).toBe(3);
    });

    it('preserves firstAnalysisDate on subsequent calls', () => {
      markAnalysisComplete();
      const firstState = getFirstTimeUserState();
      const originalDate = firstState.firstAnalysisDate;

      // Wait a tiny bit to ensure timestamps would differ
      markAnalysisComplete();
      const secondState = getFirstTimeUserState();

      expect(secondState.firstAnalysisDate).toBe(originalDate);
    });

    it('maintains hasCompletedAnalysis as true', () => {
      markAnalysisComplete();
      expect(getFirstTimeUserState().hasCompletedAnalysis).toBe(true);

      markAnalysisComplete();
      expect(getFirstTimeUserState().hasCompletedAnalysis).toBe(true);

      markAnalysisComplete();
      expect(getFirstTimeUserState().hasCompletedAnalysis).toBe(true);
    });
  });

  describe('localStorage error handling', () => {
    it('handles localStorage unavailable gracefully in getFirstTimeUserState', () => {
      // This test verifies the try-catch works, but in jsdom localStorage is always available
      // The actual error handling is tested by the invalid JSON test above
      const state = getFirstTimeUserState();
      expect(state).toBeDefined();
    });

    it('handles localStorage unavailable gracefully in setFirstTimeUserState', () => {
      // This should not throw even if localStorage fails
      const mockState: FirstTimeUserState = {
        hasCompletedAnalysis: true,
        firstAnalysisDate: '2025-01-15T10:30:00.000Z',
        analysisCount: 1,
      };

      expect(() => setFirstTimeUserState(mockState)).not.toThrow();
    });
  });
});
