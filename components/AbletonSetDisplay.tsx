/**
 * Ableton Set Display — Shows parsed .als file contents
 *
 * Renders track layout, device chains, BPM, time signature, and sample refs
 * extracted from an Ableton Live Set file.
 */

import React, { useState } from 'react';
import {
  FileAudio,
  Music2,
  Mic2,
  Layers,
  Undo2,
  Settings2,
  ChevronDown,
  ChevronUp,
  Power,
  PowerOff,
} from 'lucide-react';
import { type AbletonSetInfo, type AbletonTrack } from '../services/abletonParser';

interface AbletonSetDisplayProps {
  setInfo: AbletonSetInfo;
}

const TRACK_ICONS: Record<AbletonTrack['type'], React.ReactNode> = {
  audio: <FileAudio className="w-3.5 h-3.5 text-blue-400" />,
  midi: <Music2 className="w-3.5 h-3.5 text-green-400" />,
  return: <Undo2 className="w-3.5 h-3.5 text-amber-400" />,
  group: <Layers className="w-3.5 h-3.5 text-purple-400" />,
  master: <Settings2 className="w-3.5 h-3.5 text-red-400" />,
};

const TRACK_COLORS: Record<AbletonTrack['type'], string> = {
  audio: 'border-blue-800/40',
  midi: 'border-green-800/40',
  return: 'border-amber-800/40',
  group: 'border-purple-800/40',
  master: 'border-red-800/40',
};

const TrackCard: React.FC<{ track: AbletonTrack }> = ({ track }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border-l-2 ${TRACK_COLORS[track.type]} bg-zinc-950/50 rounded-r-lg px-3 py-2`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {TRACK_ICONS[track.type]}
          <span className="text-xs font-semibold text-zinc-200 truncate">{track.name}</span>
          <span className="text-[9px] uppercase text-zinc-600 tracking-wider">{track.type}</span>
          {track.muted && (
            <span className="text-[9px] text-red-500 font-bold">MUTE</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {track.devices.length > 0 && (
            <span className="text-[10px] mono text-zinc-500">
              {track.devices.length} device{track.devices.length !== 1 ? 's' : ''}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-zinc-600" />
          ) : (
            <ChevronDown className="w-3 h-3 text-zinc-600" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 pl-5">
          {track.devices.length > 0 && (
            <div>
              <span className="text-[9px] uppercase text-zinc-600 tracking-wider font-bold">
                Devices
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {track.devices.map((device, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 text-[10px] mono px-1.5 py-0.5 rounded border ${
                      device.isOn
                        ? 'bg-zinc-800/50 text-zinc-300 border-zinc-700'
                        : 'bg-zinc-900/50 text-zinc-600 border-zinc-800 line-through'
                    }`}
                  >
                    {device.isOn ? (
                      <Power className="w-2.5 h-2.5 text-green-500" />
                    ) : (
                      <PowerOff className="w-2.5 h-2.5 text-zinc-600" />
                    )}
                    {device.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {track.sampleRefs.length > 0 && (
            <div>
              <span className="text-[9px] uppercase text-zinc-600 tracking-wider font-bold">
                Samples
              </span>
              <div className="mt-1 space-y-0.5">
                {track.sampleRefs.slice(0, 5).map((ref, i) => (
                  <p key={i} className="text-[10px] text-zinc-500 mono truncate" title={ref}>
                    {ref.split('/').pop() || ref}
                  </p>
                ))}
                {track.sampleRefs.length > 5 && (
                  <p className="text-[10px] text-zinc-600">
                    +{track.sampleRefs.length - 5} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AbletonSetDisplay: React.FC<AbletonSetDisplayProps> = ({ setInfo }) => {
  const audioCount = setInfo.tracks.filter((t) => t.type === 'audio').length;
  const midiCount = setInfo.tracks.filter((t) => t.type === 'midi').length;
  const returnCount = setInfo.tracks.filter((t) => t.type === 'return').length;

  return (
    <section className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-orange-900/30 rounded-full border border-orange-700/30">
          <Mic2 className="w-5 h-5 text-orange-400" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
            Ableton Live Set
          </h2>
          <p className="text-[10px] text-zinc-500 mono tracking-widest uppercase">
            {setInfo.creator}
          </p>
        </div>
      </div>

      {/* Set Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-center">
          <span className="text-[9px] uppercase text-zinc-600 tracking-wider block">BPM</span>
          <span className="text-sm font-bold text-zinc-200 mono">{setInfo.bpm}</span>
        </div>
        <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-center">
          <span className="text-[9px] uppercase text-zinc-600 tracking-wider block">Time Sig</span>
          <span className="text-sm font-bold text-zinc-200 mono">
            {setInfo.timeSignatureNumerator}/{setInfo.timeSignatureDenominator}
          </span>
        </div>
        <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-center">
          <span className="text-[9px] uppercase text-zinc-600 tracking-wider block">Tracks</span>
          <span className="text-sm font-bold text-zinc-200 mono">
            {audioCount}A / {midiCount}M
          </span>
        </div>
        <div className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-center">
          <span className="text-[9px] uppercase text-zinc-600 tracking-wider block">Devices</span>
          <span className="text-sm font-bold text-zinc-200 mono">
            {setInfo.uniqueDevices.length}
          </span>
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-1.5 mb-4">
        <span className="text-[10px] uppercase text-zinc-500 tracking-wider font-bold">
          Track Layout ({setInfo.tracks.length} tracks)
        </span>
        <div className="space-y-1">
          {setInfo.tracks
            .filter((t) => t.type !== 'master')
            .map((track, i) => (
              <TrackCard key={i} track={track} />
            ))}
        </div>
        {/* Master track last */}
        {setInfo.tracks
          .filter((t) => t.type === 'master')
          .map((track, i) => (
            <TrackCard key={`master-${i}`} track={track} />
          ))}
      </div>

      {/* Device Summary */}
      {setInfo.uniqueDevices.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] uppercase text-zinc-500 tracking-wider font-bold block mb-1.5">
            All Devices Used
          </span>
          <div className="flex flex-wrap gap-1">
            {setInfo.uniqueDevices.map((device, i) => (
              <span
                key={i}
                className="text-[10px] mono px-1.5 py-0.5 bg-zinc-800/50 text-zinc-400 rounded border border-zinc-700"
              >
                {device}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sample Summary */}
      {setInfo.uniqueSamples.length > 0 && (
        <div>
          <span className="text-[10px] uppercase text-zinc-500 tracking-wider font-bold block mb-1.5">
            Sample References ({setInfo.uniqueSamples.length})
          </span>
          <div className="max-h-24 overflow-y-auto space-y-0.5 text-[10px] mono text-zinc-500">
            {setInfo.uniqueSamples.slice(0, 20).map((sample, i) => (
              <p key={i} className="truncate" title={sample}>
                {sample.split('/').pop() || sample}
              </p>
            ))}
            {setInfo.uniqueSamples.length > 20 && (
              <p className="text-zinc-600">+{setInfo.uniqueSamples.length - 20} more</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AbletonSetDisplay;
