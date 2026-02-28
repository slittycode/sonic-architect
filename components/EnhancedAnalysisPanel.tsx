/**
 * Enhanced Analysis Panel
 *
 * Displays all advanced sonic analysis features:
 * - Sidechain pump detection
 * - Bass decay analysis
 * - Swing/groove detection
 * - Acid/303 detection
 * - Reverb tail (RT60) analysis
 * - Kick distortion (THD)
 * - Supersaw detection
 * - Vocal detection
 */

import React from 'react';
import {
  Waves,
  Activity,
  Music2,
  Mic2,
  Sparkles,
  Droplets,
  Drum,
  Guitar,
  Zap,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Gauge,
  Tag,
} from 'lucide-react';
import { GlobalTelemetry } from '../types';

interface EnhancedAnalysisPanelProps {
  telemetry: GlobalTelemetry;
}

// ── Reusable Card Component ──────────────────────────────────────────────────

const AnalysisCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  accent: 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'cyan' | 'indigo' | 'rose';
  children: React.ReactNode;
  confidence?: number;
}> = ({ icon, title, accent, children, confidence }) => {
  const accentClasses = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    green: 'border-green-500/30 bg-green-500/5',
    purple: 'border-purple-500/30 bg-purple-500/5',
    orange: 'border-orange-500/30 bg-orange-500/5',
    pink: 'border-pink-500/30 bg-pink-500/5',
    cyan: 'border-cyan-500/30 bg-cyan-500/5',
    indigo: 'border-indigo-500/30 bg-indigo-500/5',
    rose: 'border-rose-500/30 bg-rose-500/5',
  };

  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    pink: 'text-pink-400',
    cyan: 'text-cyan-400',
    indigo: 'text-indigo-400',
    rose: 'text-rose-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${accentClasses[accent]} transition-all hover:border-opacity-50`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={iconColors[accent]}>{icon}</div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">{title}</h4>
        </div>
        {confidence !== undefined && (
          <div className="flex items-center gap-1">
            <Gauge className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] font-mono text-zinc-400">{Math.round(confidence * 100)}%</span>
          </div>
        )}
      </div>
      {children}
    </div>
  );
};

// ── Meter Component ──────────────────────────────────────────────────────────

const MeterBar: React.FC<{
  value: number;
  min: number;
  max: number;
  label?: string;
  color?: string;
  showValue?: boolean;
  unit?: string;
}> = ({ value, min, max, label, color = 'bg-blue-500', showValue = true, unit = '' }) => {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-zinc-500">{label}</span>
          {showValue && (
            <span className="text-[10px] font-mono text-zinc-300">
              {value.toFixed(2)}
              {unit}
            </span>
          )}
        </div>
      )}
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// ── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{
  active: boolean;
  activeText: string;
  inactiveText: string;
  activeColor?: 'green' | 'blue' | 'purple' | 'orange' | 'pink';
}> = ({ active, activeText, inactiveText, activeColor = 'green' }) => {
  const colors = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${
        active ? colors[activeColor] : 'bg-zinc-800 text-zinc-500 border-zinc-700'
      }`}
    >
      {active ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <AlertTriangle className="w-3 h-3" />
      )}
      {active ? activeText : inactiveText}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────

const EnhancedAnalysisPanel: React.FC<EnhancedAnalysisPanelProps> = ({ telemetry }) => {
  const hasEnhancedData =
    telemetry.sidechainAnalysis ||
    telemetry.bassAnalysis ||
    telemetry.swingAnalysis ||
    telemetry.acidAnalysis ||
    telemetry.reverbAnalysis ||
    telemetry.kickAnalysis ||
    telemetry.supersawAnalysis ||
    telemetry.vocalAnalysis ||
    telemetry.maestAnalysis;

  if (!hasEnhancedData) {
    return (
      <div className="p-8 text-center text-zinc-500">
        <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Enhanced analysis data not available for this track.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          Enhanced Sonic Analysis
        </h3>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sidechain Pump Detection */}
        {telemetry.sidechainAnalysis && (
          <AnalysisCard
            icon={<Waves className="w-4 h-4" />}
            title="Sidechain Pump"
            accent="blue"
            confidence={telemetry.sidechainAnalysis.strength}
          >
            <div className="space-y-3">
              <StatusBadge
                active={telemetry.sidechainAnalysis.hasSidechain}
                activeText="Detected"
                inactiveText="Not Detected"
                activeColor="blue"
              />
              <MeterBar
                value={telemetry.sidechainAnalysis.strength}
                min={0}
                max={1}
                label="Pump Strength"
                color="bg-blue-500"
                unit=""
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {telemetry.sidechainAnalysis.hasSidechain
                  ? telemetry.sidechainAnalysis.strength > 0.5
                    ? 'Strong sidechain compression typical of house/tech-house. Bass ducks noticeably on each kick hit.'
                    : 'Moderate sidechain compression. Subtle pumping effect adds groove.'
                  : 'No significant sidechain detected. Typical of minimal techno, ambient, or dry mixes.'}
              </p>
            </div>
          </AnalysisCard>
        )}

        {/* Bass Decay Analysis */}
        {telemetry.bassAnalysis && (
          <AnalysisCard icon={<Activity className="w-4 h-4" />} title="Bass Decay" accent="green">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-[10px] font-bold uppercase text-zinc-300">
                  {telemetry.bassAnalysis.type}
                </span>
              </div>
              <MeterBar
                value={telemetry.bassAnalysis.decayMs}
                min={0}
                max={1000}
                label="Decay Time"
                color="bg-green-500"
                unit="ms"
              />
              <MeterBar
                value={telemetry.bassAnalysis.transientRatio}
                min={0}
                max={1}
                label="Transient Sharpness"
                color="bg-green-400"
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {telemetry.bassAnalysis.type === 'punchy' &&
                  'Short, punchy bass decay. Characteristic of house, tech-house, and garage. Bass hits hard and gets out of the way.'}
                {telemetry.bassAnalysis.type === 'medium' &&
                  'Medium bass decay. Balanced between punch and sustain. Common in techno and progressive.'}
                {telemetry.bassAnalysis.type === 'rolling' &&
                  'Long, rolling bass decay. Typical of trance, driving techno, and dubstep. Bass has sustained energy.'}
                {telemetry.bassAnalysis.type === 'sustained' &&
                  'Sustained bass content. Could indicate drone, pad, or ambient bass textures.'}
              </p>
            </div>
          </AnalysisCard>
        )}

        {/* Swing/Groove Detection */}
        {telemetry.swingAnalysis && (
          <AnalysisCard icon={<Music2 className="w-4 h-4" />} title="Groove/Swing" accent="purple">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Drum className="w-3 h-3 text-purple-400" />
                <span className="text-[10px] font-bold uppercase text-zinc-300">
                  {telemetry.swingAnalysis.grooveType.replace('-', ' ')}
                </span>
              </div>
              <MeterBar
                value={telemetry.swingAnalysis.swingPercent}
                min={0}
                max={50}
                label={`Swing: ${telemetry.swingAnalysis.swingPercent}%`}
                color="bg-purple-500"
                showValue={false}
              />

              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {telemetry.swingAnalysis.grooveType === 'straight' &&
                  'Straight, quantized rhythm. Typical of techno, trance, and most 4-on-floor electronic music.'}
                {telemetry.swingAnalysis.grooveType === 'slight-swing' &&
                  'Subtle swing added. Common in deep house and minimal for added groove.'}
                {telemetry.swingAnalysis.grooveType === 'heavy-swing' &&
                  'Noticeable swing/shuffle. Characteristic of garage, 2-step, and hip-hop influenced beats.'}
                {telemetry.swingAnalysis.grooveType === 'shuffle' &&
                  'Strong shuffle pattern. Typical of UK garage, 2-step, and swing-based rhythms.'}
              </p>
            </div>
          </AnalysisCard>
        )}

        {/* Acid/303 Detection */}
        {telemetry.acidAnalysis && (
          <AnalysisCard
            icon={<Zap className="w-4 h-4" />}
            title="Acid/303 Detection"
            accent="pink"
            confidence={telemetry.acidAnalysis.confidence}
          >
            <div className="space-y-3">
              <StatusBadge
                active={telemetry.acidAnalysis.isAcid}
                activeText="Acid Detected"
                inactiveText="No Acid"
                activeColor="pink"
              />
              {telemetry.acidAnalysis.isAcid && (
                <>
                  <MeterBar
                    value={telemetry.acidAnalysis.resonanceLevel}
                    min={0}
                    max={1}
                    label="Resonance Level"
                    color="bg-pink-500"
                  />
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    TB-303-style acid bassline detected. Characteristic resonant filter sweeps and 16th-note patterns.
                    Typical of acid techno and acid house.
                  </p>
                </>
              )}
              {!telemetry.acidAnalysis.isAcid && (
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  No TB-303 acid pattern detected. Bass content appears to be standard synthesis or samples.
                </p>
              )}
            </div>
          </AnalysisCard>
        )}

        {/* Reverb Tail Analysis */}
        {telemetry.reverbAnalysis && (
          <AnalysisCard icon={<Droplets className="w-4 h-4" />} title="Reverb Tail (RT60)" accent="cyan">
            <div className="space-y-3">
              <StatusBadge
                active={telemetry.reverbAnalysis.isWet}
                activeText="Wet"
                inactiveText="Dry"
                activeColor="cyan"
              />
              <MeterBar
                value={telemetry.reverbAnalysis.rt60}
                min={0}
                max={3}
                label="RT60"
                color="bg-cyan-500"
                unit="s"
              />
              <MeterBar
                value={telemetry.reverbAnalysis.tailEnergyRatio}
                min={0}
                max={1}
                label="Tail Energy"
                color="bg-cyan-400"
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {telemetry.reverbAnalysis.isWet
                  ? telemetry.reverbAnalysis.rt60 > 1.5
                    ? 'Long reverb tail. Characteristic of dub techno, ambient, and spacious productions.'
                    : 'Moderate reverb. Adds depth and space without overwhelming the mix.'
                  : 'Dry mix with short reverb. Typical of hard techno, hip-hop, and in-your-face productions.'}
              </p>
            </div>
          </AnalysisCard>
        )}

        {/* Kick Distortion Analysis */}
        {telemetry.kickAnalysis && (
          <AnalysisCard icon={<Drum className="w-4 h-4" />} title="Kick Distortion" accent="orange">
            <div className="space-y-3">
              <StatusBadge
                active={telemetry.kickAnalysis.isDistorted}
                activeText="Distorted"
                inactiveText="Clean"
                activeColor={telemetry.kickAnalysis.isDistorted ? 'orange' : 'green'}
              />
              <MeterBar
                value={telemetry.kickAnalysis.thd}
                min={0}
                max={0.6}
                label={`THD: ${(telemetry.kickAnalysis.thd * 100).toFixed(0)}%`}
                color={telemetry.kickAnalysis.isDistorted ? 'bg-orange-500' : 'bg-green-500'}
                showValue={false}
              />
              <MeterBar
                value={telemetry.kickAnalysis.harmonicRatio}
                min={0}
                max={1}
                label="Harmonic Content"
                color="bg-orange-400"
              />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {telemetry.kickAnalysis.isDistorted
                  ? 'Distorted kick drum detected. High harmonic content from saturation or distortion. Characteristic of hard techno, industrial, and hardstyle.'
                  : 'Clean kick drum. Low harmonic distortion. Typical of house, techno, and most club music.'}
              </p>
            </div>
          </AnalysisCard>
        )}

        {/* Supersaw Detection */}
        {telemetry.supersawAnalysis && (
          <AnalysisCard icon={<Guitar className="w-4 h-4" />} title="Supersaw Detection" accent="indigo">
            <div className="space-y-3">
              <StatusBadge
                active={telemetry.supersawAnalysis.isSupersaw}
                activeText="Supersaw"
                inactiveText="No Supersaw"
                activeColor="indigo"
              />
              {telemetry.supersawAnalysis.isSupersaw && (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <span>~{telemetry.supersawAnalysis.voiceCount} voices</span>
                    <span>•</span>
                    <span>{Math.round(telemetry.supersawAnalysis.confidence * 100)}% confidence</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Supersaw synthesizer pattern detected. Multiple detuned sawtooth waves creating a thick, rich sound.
                    Characteristic of trance, progressive house, and big room EDM.
                  </p>
                </>
              )}
              {!telemetry.supersawAnalysis.isSupersaw && (
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  No supersaw pattern detected. Lead/synth content appears to use other synthesis methods.
                </p>
              )}
            </div>
          </AnalysisCard>
        )}

        {/* Vocal Detection */}
        {telemetry.vocalAnalysis && (
          <AnalysisCard
            icon={<Mic2 className="w-4 h-4" />}
            title="Vocal Detection"
            accent="rose"
            confidence={telemetry.vocalAnalysis.confidence}
          >
            <div className="space-y-3">
              <StatusBadge
                active={telemetry.vocalAnalysis.hasVocals}
                activeText="Vocals"
                inactiveText="Instrumental"
                activeColor="rose"
              />
              {telemetry.vocalAnalysis.hasVocals && (
                <>
                  <MeterBar
                    value={telemetry.vocalAnalysis.vocalEnergyRatio}
                    min={0}
                    max={0.6}
                    label="Vocal Energy Ratio"
                    color="bg-rose-500"
                    showValue={false}
                  />
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Vocal content detected in the mix. Formant structure and spectral characteristics indicate
                    human voice presence.
                  </p>
                </>
              )}
              {!telemetry.vocalAnalysis.hasVocals && (
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  No significant vocal content detected. This appears to be an instrumental track.
                </p>
              )}
            </div>
          </AnalysisCard>
        )}

        {/* Discogs Style Match (MAEST browser ML) */}
        {telemetry.maestAnalysis && (
          <AnalysisCard
            icon={<Tag className="w-4 h-4" />}
            title="Discogs Style Match"
            accent="purple"
            confidence={telemetry.maestAnalysis.topScore}
          >
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">Style Family</p>
                <p className="text-sm font-bold text-zinc-200">{telemetry.maestAnalysis.primaryFamily}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 mb-0.5">Subgenre</p>
                <p className="text-xs font-semibold text-purple-300">
                  {telemetry.maestAnalysis.primarySubgenre}
                </p>
              </div>
              <div className="space-y-1.5">
                {telemetry.maestAnalysis.topLabels.slice(0, 5).map(({ label, score }) => {
                  const parts = label.split('---');
                  const shortLabel = parts[parts.length - 1]?.trim() ?? label;
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${Math.round(score * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400 w-24 truncate text-right">
                        {shortLabel}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
                        {Math.round(score * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Browser ML classification using Discogs MAEST model trained on 400+ music styles.
                Results are probabilistic and complement DSP analysis.
              </p>
            </div>
          </AnalysisCard>
        )}
      </div>

      {/* Genre Classification Summary */}
      {(telemetry.enhancedGenre || telemetry.genreFamily) && (
        <div className="px-5 pb-5">
          <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Genre Classification Summary
              </h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">Primary Genre</p>
                <p className="text-sm font-bold text-zinc-200 capitalize">
                  {(telemetry.enhancedGenre || 'N/A').replace(/-/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 mb-1">Genre Family</p>
                <p className="text-sm font-bold text-zinc-200 capitalize">
                  {(telemetry.genreFamily || 'N/A').replace(/-/g, ' ')}
                </p>
              </div>
              {telemetry.secondaryGenre && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">Secondary</p>
                  <p className="text-sm font-bold text-zinc-200 capitalize">
                    {telemetry.secondaryGenre.replace(/-/g, ' ')}
                  </p>
                </div>
              )}
              {telemetry.acidAnalysis?.isAcid && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">Characteristics</p>
                  <p className="text-sm font-bold text-pink-400">Acid Bassline</p>
                </div>
              )}
              {telemetry.kickAnalysis?.isDistorted && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">Characteristics</p>
                  <p className="text-sm font-bold text-orange-400">Distorted Kicks</p>
                </div>
              )}
              {telemetry.supersawAnalysis?.isSupersaw && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">Characteristics</p>
                  <p className="text-sm font-bold text-indigo-400">Supersaw Leads</p>
                </div>
              )}
              {telemetry.vocalAnalysis?.hasVocals && (
                <div>
                  <p className="text-[10px] text-zinc-500 mb-1">Characteristics</p>
                  <p className="text-sm font-bold text-rose-400">Vocals</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedAnalysisPanel;
