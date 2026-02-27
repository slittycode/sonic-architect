import { AudioFeatures, MixDoctorReport, MixAdvice } from '../types';
import { getProfile } from '../data/genreProfiles';

/** Return the median of a numeric array (sorts in place). */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

/**
 * Compare an analyzed track's audio features against a genre profile
 * to produce mix/mastering feedback and an overall deviation score.
 */
export function generateMixReport(
  features: AudioFeatures,
  genreId: string = 'edm'
): MixDoctorReport {
  const profile = getProfile(genreId);

  // Compute median offset between measured and target dB to normalise for
  // input loudness.  This lets us evaluate spectral SHAPE (relative balance)
  // rather than absolute level, which varies with mastering and file format.
  const offsets: number[] = [];
  for (const band of features.spectralBands) {
    const target = profile.spectralTargets[band.name];
    if (!target) continue;
    offsets.push(band.averageDb - target.optimalDb);
  }
  const loudnessOffset = offsets.length >= 3 ? median(offsets) : 0;

  const advice: MixAdvice[] = [];
  let scoreAccumulator = 0;
  let bandsEvaluated = 0;

  // Evaluate spectral balance
  for (const band of features.spectralBands) {
    const target = profile.spectralTargets[band.name];
    if (!target) continue;

    const currentDb = band.averageDb - loudnessOffset;
    const diffToOptimal = currentDb - target.optimalDb;
    let issue: MixAdvice['issue'] = 'optimal';
    let message = `Balanced.`;

    // Range-aware scoring: inside [minDb, maxDb] → 80-100 points,
    // outside → drops from 80 at 5 pts/dB past boundary.
    const inRange = currentDb >= target.minDb && currentDb <= target.maxDb;
    let bandScore: number;
    if (inRange) {
      const rangeHalf = (target.maxDb - target.minDb) / 2;
      const normalizedDiff = rangeHalf > 0 ? Math.abs(diffToOptimal) / rangeHalf : 0;
      bandScore = 100 - normalizedDiff * 20;
    } else {
      const overshoot = currentDb > target.maxDb
        ? currentDb - target.maxDb
        : target.minDb - currentDb;
      bandScore = 80 - overshoot * 5;
    }
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

  // --- Evaluate LUFS loudness ---
  let loudnessAdvice: MixDoctorReport['loudnessAdvice'];
  let loudnessPenalty = 0;

  if (features.lufsIntegrated != null && features.truePeak != null && profile.targetLufsRange) {
    const lufs = features.lufsIntegrated;
    const [minLufs, maxLufs] = profile.targetLufsRange;
    let loudnessIssue: 'too-loud' | 'too-quiet' | 'optimal' = 'optimal';
    let loudnessMsg = `Loudness is on target at ${lufs} LUFS. Good for streaming platforms.`;

    if (lufs > maxLufs) {
      loudnessIssue = 'too-loud';
      loudnessMsg = `Too loud at ${lufs} LUFS (target: ${maxLufs} LUFS max for ${profile.name}). Streaming platforms will turn it down — reduce limiter gain.`;
      loudnessPenalty = Math.min(10, (lufs - maxLufs) * 2);
    } else if (lufs < minLufs) {
      loudnessIssue = 'too-quiet';
      loudnessMsg = `Quiet at ${lufs} LUFS (target: ${minLufs} LUFS min for ${profile.name}). Consider adding gain or a limiter to bring up overall level.`;
      loudnessPenalty = Math.min(10, (minLufs - lufs) * 2);
    }

    // True peak warning
    if (features.truePeak > -1) {
      loudnessMsg += ` True peak at ${features.truePeak} dBTP — risk of clipping on codec conversion. Target -1 dBTP ceiling.`;
      loudnessPenalty += 3;
    }

    loudnessAdvice = {
      issue: loudnessIssue,
      message: loudnessMsg,
      actualLufs: lufs,
      truePeak: features.truePeak,
    };
  }

  // --- Evaluate stereo field ---
  let stereoAdvice: MixDoctorReport['stereoAdvice'];
  let stereoPenalty = 0;

  if (features.stereoCorrelation != null && features.stereoWidth != null) {
    const corr = features.stereoCorrelation;
    const width = features.stereoWidth;
    const mono = features.monoCompatible ?? true;
    let stereoMsg = `Stereo field looks good — correlation ${corr}, width ${Math.round(width * 100)}%.`;

    if (!mono) {
      stereoMsg = `Phase cancellation detected in low frequencies. Bass will lose energy on mono playback (PA systems, phone speakers). Narrow your sub bass to mono.`;
      stereoPenalty = 5;
    } else if (corr < 0.2) {
      stereoMsg = `Very wide stereo image (correlation ${corr}). May sound thin when summed to mono. Consider narrowing bass and mid elements.`;
      stereoPenalty = 3;
    } else if (corr > 0.95 && width < 0.05) {
      stereoMsg = `Nearly mono — very narrow stereo image. Consider widening with stereo delay, chorus, or panning elements.`;
      stereoPenalty = 2;
    }

    stereoAdvice = { correlation: corr, width, monoCompatible: mono, message: stereoMsg };
  }

  // Final score 0 - 100
  // Compute band average first, then subtract dynamics + loudness + stereo penalties so
  // their impact is consistent regardless of how many bands were evaluated.
  let overallScore = bandsEvaluated > 0 ? scoreAccumulator / bandsEvaluated : 0;
  overallScore -= dynamicsPenalty;
  overallScore -= loudnessPenalty;
  overallScore -= stereoPenalty;
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
    loudnessAdvice,
    stereoAdvice,
    overallScore,
  };
}
