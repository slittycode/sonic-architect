import { describe, expect, it } from 'vitest';
import { getFrameDurationSeconds } from '../pitchDetection';

describe('getFrameDurationSeconds', () => {
  it('uses runtime sample rate instead of a hardcoded constant', () => {
    const at44k = getFrameDurationSeconds(44100);
    const at48k = getFrameDurationSeconds(48000);
    const expected48k = 512 / 48000;

    expect(at48k).toBeCloseTo(expected48k, 10);
    expect(at48k).not.toBeCloseTo(at44k, 4);
  });

  it('rejects invalid sample rates', () => {
    expect(() => getFrameDurationSeconds(0)).toThrowError();
    expect(() => getFrameDurationSeconds(-1)).toThrowError();
  });
});
