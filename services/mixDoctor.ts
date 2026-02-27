import { AudioFeatures, MixDoctorReport, MixAdvice } from '../types';
import { getProfile } from '../data/genreProfiles';

/**
 * Compare an analyzed track's audio features against a genre profile
 * to produce mix/mastering feedback and an overall deviation score.
 */
export function generateMixReport(
  features: AudioFeatures,
  genreId: string = 'edm'
): MixDoctorReport {
  const profile = getProfile(genreId);

  const advice: MixAdvice[] = [];
  let scoreAccumulator = 0;
  let bandsEvaluated = 0;

  // Evaluate spectral balance
  for (const band of features.spectralBands) {
    const target = profile.spectralTargets[band.name];
    if (!target) continue;

    const currentDb = band.averageDb;
    const diffToOptimal = currentDb - target.optimalDb;
    let issue: MixAdvice['issue'] = 'optimal';
    let message = `Balanced.`;

    // Deviation scoring (0-100 scale per band)
    // 0 error = 100 points. Max error (say 15dB) = 0 points.
    let bandScore = 100 - Math.abs(diffToOptimal) * 6.66;
    bandScore = Math.max(0, Math.min(100, bandScore));
    scoreAccumulator += bandScore;
    bandsEvaluated++;

    // Generate specific text advice based on thresholds
    if (currentDb > target.maxDb) {
      issue = 'too-loud';
      const exceed = (currentDb - target.maxDb).toFixed(1);

      switch (band.name) {
        case 'Sub Bass':
          message = `Muddy/overpowering subs. Highpass non-bass elements or turn down the sub layer by ~${exceed}dB.`;
          break;
        case 'Low Mids':
          message = `Boxy or muddy. Cut around 300-400Hz to clear space for kick/bass.`;
          break;
        case 'Highs':
          message = `Harsh and piercing. De-ess vocals or cut 6-8kHz.`;
          break;
        default:
          message = `Too prominent. Reduce by ~${exceed}dB to match commercial ${profile.name} tracks.`;
      }
    } else if (currentDb < target.minDb) {
      issue = 'too-quiet';
      const deficit = (target.minDb - currentDb).toFixed(1);

      switch (band.name) {
        case 'Sub Bass':
          message = `Weak low end. Add sub harmonics or boost <80Hz by ~${deficit}dB.`;
          break;
        case 'Mids':
          message = `Hollow mix. Boost fundamentals of synths/vocals to add body.`;
          break;
        case 'Brilliance':
          message = `Lacking 'air' and width. Apply a high shelf boost > 10kHz.`;
          break;
        default:
          message = `Lacking energy. Boost by ~${deficit}dB.`;
      }
    }

    advice.push({
      band: band.name,
      issue,
      message,
      diffDb: Math.round(diffToOptimal * 10) / 10,
    });
  }

  // Evaluate dynamics (Crest Factor)
  let dynamicsIssue: 'too-compressed' | 'too-dynamic' | 'optimal' = 'optimal';
  let dynamicsMsg = 'Solid dynamic range. Fits the genre well.';
  let dynamicsPenalty = 0;

  const crest = features.crestFactor;
  const [minCrest, maxCrest] = profile.targetCrestFactorRange;

  if (crest < minCrest) {
    dynamicsIssue = 'too-compressed';
    dynamicsMsg =
      'Too compressed/squashed. The mix lacks transient punch. Ease off the master limiter or bus compressors.';
    // Proportional penalty: 2.5 pts per dB outside range, capped at 15
    dynamicsPenalty = Math.min(15, (minCrest - crest) * 2.5);
  } else if (crest > maxCrest) {
    dynamicsIssue = 'too-dynamic';
    dynamicsMsg =
      'Too dynamic. Transients are jumping out too much. Add bus compression or saturation to glue the mix.';
    dynamicsPenalty = Math.min(15, (crest - maxCrest) * 2.5);
  }

  // Final score 0 - 100
  // Compute band average first, then subtract dynamics penalty so its impact
  // is consistent regardless of how many bands were evaluated.
  let overallScore = bandsEvaluated > 0 ? scoreAccumulator / bandsEvaluated : 0;
  overallScore -= dynamicsPenalty;
  overallScore = Math.round(Math.max(0, Math.min(100, overallScore)));

  return {
    genre: profile.name,
    targetProfile: profile,
    advice,
    dynamicsAdvice: {
      issue: dynamicsIssue,
      message: dynamicsMsg,
      actualCrest: Math.round(crest * 10) / 10,
    },
    overallScore,
  };
}
