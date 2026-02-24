import { GenreProfile } from '../types';

/**
 * Static knowledge base defining standard spectral and dynamic profiles for genres.
 * Values are in dB relative to full scale (dBFS), representing the *average*
 * energy expected in that spectral band for a commercially mixed track.
 *
 * Spectral bands (from audioAnalysis.ts):
 * - Sub Bass (20-80 Hz)
 * - Low Bass (80-250 Hz)
 * - Low Mids (250-500 Hz)
 * - Mids (500-2000 Hz)
 * - Upper Mids (2000-5000 Hz)
 * - Highs (5000-10000 Hz)
 * - Brilliance (10000-20000 Hz)
 */
export const GENRE_PROFILES: GenreProfile[] = [
  {
    id: 'edm',
    name: 'Electronic / EDM',
    targetCrestFactorRange: [5, 9], // heavily compressed
    spectralTargets: {
      'Sub Bass': { minDb: -15, maxDb: -8, optimalDb: -11 },
      'Low Bass': { minDb: -18, maxDb: -10, optimalDb: -14 },
      'Low Mids': { minDb: -26, maxDb: -18, optimalDb: -22 }, // often scooped for clarity
      Mids: { minDb: -22, maxDb: -14, optimalDb: -18 },
      'Upper Mids': { minDb: -24, maxDb: -16, optimalDb: -20 },
      Highs: { minDb: -28, maxDb: -18, optimalDb: -23 },
      Brilliance: { minDb: -32, maxDb: -22, optimalDb: -27 },
    },
  },
  {
    id: 'hiphop',
    name: 'Hip Hop / Trap',
    targetCrestFactorRange: [7, 11], // punchy drums, thick subs
    spectralTargets: {
      'Sub Bass': { minDb: -16, maxDb: -6, optimalDb: -10 }, // loudest sub bass
      'Low Bass': { minDb: -20, maxDb: -10, optimalDb: -15 },
      'Low Mids': { minDb: -28, maxDb: -18, optimalDb: -23 }, // vocal space
      Mids: { minDb: -20, maxDb: -12, optimalDb: -16 }, // vocal presence
      'Upper Mids': { minDb: -24, maxDb: -15, optimalDb: -19 },
      Highs: { minDb: -26, maxDb: -18, optimalDb: -22 },
      Brilliance: { minDb: -30, maxDb: -22, optimalDb: -26 },
    },
  },
  {
    id: 'rock',
    name: 'Rock / Metal',
    targetCrestFactorRange: [9, 14], // more dynamic range, transient drums
    spectralTargets: {
      'Sub Bass': { minDb: -25, maxDb: -15, optimalDb: -20 }, // less sub weight
      'Low Bass': { minDb: -18, maxDb: -10, optimalDb: -14 }, // bass guitar & kick
      'Low Mids': { minDb: -20, maxDb: -12, optimalDb: -16 }, // guitar body
      Mids: { minDb: -18, maxDb: -10, optimalDb: -14 }, // guitars out front
      'Upper Mids': { minDb: -20, maxDb: -12, optimalDb: -16 }, // vocal & guitar attack
      Highs: { minDb: -24, maxDb: -16, optimalDb: -20 }, // cymbals
      Brilliance: { minDb: -30, maxDb: -20, optimalDb: -25 },
    },
  },
  {
    id: 'pop',
    name: 'Modern Pop',
    targetCrestFactorRange: [6, 10], // controlled, loud, vocal upfront
    spectralTargets: {
      'Sub Bass': { minDb: -18, maxDb: -10, optimalDb: -14 },
      'Low Bass': { minDb: -18, maxDb: -12, optimalDb: -15 },
      'Low Mids': { minDb: -24, maxDb: -16, optimalDb: -20 },
      Mids: { minDb: -18, maxDb: -10, optimalDb: -14 }, // vocal upfront
      'Upper Mids': { minDb: -18, maxDb: -10, optimalDb: -14 }, // vocal presence/air
      Highs: { minDb: -22, maxDb: -14, optimalDb: -18 }, // bright & airy
      Brilliance: { minDb: -26, maxDb: -16, optimalDb: -20 },
    },
  },
  {
    id: 'acoustic',
    name: 'Acoustic / Indie',
    targetCrestFactorRange: [12, 18], // highly dynamic, uncompressed
    spectralTargets: {
      'Sub Bass': { minDb: -35, maxDb: -25, optimalDb: -30 }, // negligible sub
      'Low Bass': { minDb: -24, maxDb: -14, optimalDb: -19 }, // acoustic body
      'Low Mids': { minDb: -22, maxDb: -14, optimalDb: -18 }, // warmth
      Mids: { minDb: -20, maxDb: -12, optimalDb: -16 },
      'Upper Mids': { minDb: -22, maxDb: -14, optimalDb: -18 },
      Highs: { minDb: -26, maxDb: -16, optimalDb: -21 }, // acoustic string noise
      Brilliance: { minDb: -32, maxDb: -22, optimalDb: -27 },
    },
  },
];

/**
 * Returns a default profile if none requested.
 */
export function getProfile(id: string): GenreProfile {
  const profile = GENRE_PROFILES.find((p) => p.id === id);
  return profile || GENRE_PROFILES[0]; // Default to EDM
}
