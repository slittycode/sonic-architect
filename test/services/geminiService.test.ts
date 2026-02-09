import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAudio } from '../../services/geminiService';

const validBlueprintJson = JSON.stringify({
  telemetry: { bpm: '120', key: 'C major', groove: 'straight' },
  arrangement: [{ timeRange: '0:00-0:15', label: 'Intro', description: 'Build' }],
  instrumentation: [
    {
      element: 'Bass',
      timbre: 'Warm',
      frequency: 'Low',
      abletonDevice: 'Operator',
    },
  ],
  fxChain: [{ artifact: 'Reverb', recommendation: 'Reverb device' }],
  secretSauce: { trick: 'Sidechain', execution: 'Use Compressor' },
});

const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function (this: unknown) {
    return {
      models: {
        generateContent: mockGenerateContent,
      },
    };
  }),
}));

describe('geminiService', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it('returns valid blueprint when Gemini returns valid JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: validBlueprintJson });

    const result = await analyzeAudio('base64data', 'audio/wav');

    expect(result.telemetry.bpm).toBe('120');
    expect(result.telemetry.key).toBe('C major');
    expect(result.secretSauce.trick).toBe('Sidechain');
    expect(Array.isArray(result.arrangement)).toBe(true);
    expect(Array.isArray(result.instrumentation)).toBe(true);
    expect(Array.isArray(result.fxChain)).toBe(true);
  });

  it('throws when Gemini response is invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'not valid json {' });

    await expect(analyzeAudio('base64data', 'audio/wav')).rejects.toThrow(
      'Could not parse analysis results. Please try again.'
    );
  });

  it('throws when Gemini response is valid JSON but missing required keys', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        telemetry: { bpm: '120', key: 'C', groove: 'x' },
        arrangement: [],
        instrumentation: [],
        fxChain: [],
        // missing secretSauce
      }),
    });

    await expect(analyzeAudio('base64data', 'audio/wav')).rejects.toThrow(
      'Invalid analysis result; please try again.'
    );
  });

  it('throws when telemetry is missing required fields', async () => {
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        telemetry: { bpm: '120' }, // missing key, groove
        arrangement: [],
        instrumentation: [],
        fxChain: [],
        secretSauce: { trick: 't', execution: 'e' },
      }),
    });

    await expect(analyzeAudio('base64data', 'audio/wav')).rejects.toThrow(
      'Invalid analysis result; please try again.'
    );
  });
});
