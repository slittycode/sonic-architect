import React from 'react';
import { AudioLines, Cloud, Cpu, MessageSquare, Settings, Upload } from 'lucide-react';
import { AnalysisStatus, type ProviderType } from '@/src/domain/providers/types';
import {
  GEMINI_MODELS,
  GEMINI_MODEL_LABELS,
  type GeminiModelId,
} from '@/services/providers/gemini/client';

interface AppHeaderProps {
  providerType: ProviderType;
  providerLabel: string;
  geminiLabel: string;
  geminiModel: GeminiModelId;
  showSettings: boolean;
  showChat: boolean;
  status: AnalysisStatus;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onToggleSettings: () => void;
  onProviderChange: (type: ProviderType) => void;
  onGeminiModelChange: (model: GeminiModelId) => void;
  onToggleChat: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export default function AppHeader({
  providerType,
  providerLabel,
  geminiLabel,
  geminiModel,
  showSettings,
  showChat,
  status,
  fileInputRef,
  onToggleSettings,
  onProviderChange,
  onGeminiModelChange,
  onToggleChat,
  onFileUpload,
}: AppHeaderProps): React.JSX.Element {
  return (
    <header className="w-full border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
            <AudioLines className="w-6 h-6 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">Sonic Architect</h1>
            <p className="text-[10px] text-zinc-500 mono tracking-widest uppercase">
              Sonic Analyzer for Ableton
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={onToggleSettings}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 text-xs rounded-md transition-all border border-zinc-700/50 focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
              aria-label="Analysis engine settings"
              title="Analysis engine settings"
            >
              <Settings className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{providerLabel}</span>
            </button>
            {showSettings && (
              <div
                className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-3 py-2 border-b border-zinc-800">
                  <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    Analysis Engine
                  </p>
                </div>
                <button
                  onClick={() => onProviderChange('local')}
                  className={`w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/50 transition-colors ${providerType === 'local' ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''}`}
                >
                  <Cpu className="w-4 h-4 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Local DSP Engine</p>
                    <p className="text-[10px] text-zinc-500">
                      Client-side analysis. No API key needed. Works offline.
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => onProviderChange('gemini')}
                  className={`w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/50 transition-colors ${providerType === 'gemini' ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''}`}
                >
                  <Cloud className="w-4 h-4 text-blue-400 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{geminiLabel}</p>
                    <p className="text-[10px] text-zinc-500">
                      Hybrid local+cloud · GEMINI_API_KEY in .env.local
                    </p>
                  </div>
                </button>
                {providerType === 'gemini' && (
                  <div className="px-3 py-2 bg-zinc-950 border-y border-zinc-800 space-y-1.5">
                    {(() => {
                      const grouped: Record<string, GeminiModelId[]> = {};
                      GEMINI_MODELS.forEach((model) => {
                        if (!grouped[model.group]) grouped[model.group] = [];
                        grouped[model.group].push(model.id);
                      });

                      const groupOrder = ['stable', 'preview', 'experimental'];
                      return groupOrder
                        .filter((group) => grouped[group]?.length)
                        .map((group) => (
                          <div key={group} className="mb-1.5">
                            <div className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider mb-1">
                              {group === 'stable'
                                ? 'Stable'
                                : group === 'preview'
                                  ? 'Preview'
                                  : group === 'experimental'
                                    ? 'Experimental'
                                    : group}
                            </div>
                            <div className="flex gap-1.5">
                              {grouped[group].map((m) => (
                                <button
                                  key={m}
                                  onClick={() => onGeminiModelChange(m)}
                                  className={`flex-1 text-[10px] font-bold py-1.5 rounded border transition-colors ${geminiModel === m ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'}`}
                                >
                                  {GEMINI_MODEL_LABELS[m].replace('Gemini ', '')}
                                </button>
                              ))}
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onToggleChat}
            className={`flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-all border focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none ${showChat ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 border-zinc-700/50'}`}
            aria-label="Toggle chat"
            title="Chat about your analysis"
          >
            <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={status === AnalysisStatus.ANALYZING}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 text-sm font-medium rounded-md transition-all border border-zinc-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 focus:outline-none"
            aria-label="Import audio stem"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Import Stem
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*"
            onChange={(event) => {
              void onFileUpload(event);
            }}
          />
        </div>
      </div>
    </header>
  );
}
