/**
 * Provider Settings Panel
 *
 * Dropdown component for selecting the analysis engine and configuring
 * provider-specific credentials/settings at runtime.
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Cloud, Brain, Sparkles, Server, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { ProviderType, ProviderCredentials } from '../types';
import { isOllamaAvailable, listOllamaModels } from '../services/ollamaClient';

// ── Credential persistence ─────────────────────────────────────────────

const CREDS_KEY = 'sonic-architect-credentials';

export function loadCredentials(): ProviderCredentials {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveCredentials(creds: ProviderCredentials): void {
  try { localStorage.setItem(CREDS_KEY, JSON.stringify(creds)); } catch {}
}

/**
 * Load credentials with .env.local fallbacks for build-time defaults.
 * Runtime entries in localStorage override env vars.
 */
export function getEffectiveCredentials(): ProviderCredentials {
  const stored = loadCredentials();
  return {
    openai: {
      apiKey: stored.openai?.apiKey || (import.meta as any).env?.VITE_OPENAI_API_KEY || '',
      model: stored.openai?.model || 'gpt-4o-mini',
      baseUrl: stored.openai?.baseUrl || 'https://api.openai.com/v1',
    },
    bedrock: {
      accessKeyId: stored.bedrock?.accessKeyId || (import.meta as any).env?.VITE_AWS_ACCESS_KEY_ID || '',
      secretAccessKey: stored.bedrock?.secretAccessKey || (import.meta as any).env?.VITE_AWS_SECRET_ACCESS_KEY || '',
      region: stored.bedrock?.region || (import.meta as any).env?.VITE_AWS_REGION || 'us-east-1',
      modelId: stored.bedrock?.modelId || 'anthropic.claude-3-haiku-20240307-v1:0',
    },
    ollama: {
      baseUrl: stored.ollama?.baseUrl || 'http://localhost:11434',
      model: stored.ollama?.model || 'llama3.2',
    },
    gemini: {
      apiKey: stored.gemini?.apiKey || (import.meta as any).env?.VITE_GEMINI_API_KEY || '',
    },
  };
}

// ── Provider metadata ──────────────────────────────────────────────────

interface ProviderOption {
  type: ProviderType;
  name: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  hasConfig: boolean;
}

const PROVIDERS: ProviderOption[] = [
  {
    type: 'local',
    name: 'Local DSP Engine',
    description: 'Client-side analysis. No API key needed. Works offline.',
    icon: <Cpu className="w-4 h-4" />,
    iconColor: 'text-emerald-400',
    hasConfig: false,
  },
  {
    type: 'ollama',
    name: 'Ollama LLM',
    description: 'Local DSP + LLM enhancement. Requires Ollama running.',
    icon: <Brain className="w-4 h-4" />,
    iconColor: 'text-purple-400',
    hasConfig: true,
  },
  {
    type: 'openai',
    name: 'OpenAI (ChatGPT)',
    description: 'Local DSP + GPT enhancement. Requires API key.',
    icon: <Sparkles className="w-4 h-4" />,
    iconColor: 'text-cyan-400',
    hasConfig: true,
  },
  {
    type: 'bedrock',
    name: 'AWS Bedrock',
    description: 'Local DSP + Claude/Llama via AWS. Requires credentials.',
    icon: <Server className="w-4 h-4" />,
    iconColor: 'text-orange-400',
    hasConfig: true,
  },
  {
    type: 'gemini',
    name: 'Gemini 1.5 Pro',
    description: 'Cloud AI analysis. Requires API key in .env.local.',
    icon: <Cloud className="w-4 h-4" />,
    iconColor: 'text-blue-400',
    hasConfig: true,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────

function SecretInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 pr-8 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
        tabIndex={-1}
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-200 placeholder-zinc-600 focus:border-blue-500 focus:outline-none"
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">{children}</label>;
}

// ── Config panels per provider ─────────────────────────────────────────

function OllamaConfig({ creds, onChange, ollamaOnline, ollamaModels }: {
  creds: ProviderCredentials;
  onChange: (c: ProviderCredentials) => void;
  ollamaOnline: boolean | null;
  ollamaModels: string[];
}) {
  const cfg = creds.ollama ?? { baseUrl: 'http://localhost:11434', model: 'llama3.2' };
  const update = (patch: Partial<typeof cfg>) => onChange({ ...creds, ollama: { ...cfg, ...patch } });

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-[10px]">
        <span className={ollamaOnline ? 'text-emerald-400' : ollamaOnline === false ? 'text-red-400' : 'text-zinc-500'}>
          {ollamaOnline ? '● Server online' : ollamaOnline === false ? '● Server offline' : '● Checking...'}
        </span>
      </div>
      <div>
        <FieldLabel>Base URL</FieldLabel>
        <TextInput value={cfg.baseUrl} onChange={v => update({ baseUrl: v })} placeholder="http://localhost:11434" />
      </div>
      <div>
        <FieldLabel>Model</FieldLabel>
        {ollamaModels.length > 0 ? (
          <SelectInput
            value={cfg.model}
            onChange={v => update({ model: v })}
            options={ollamaModels.map(m => ({ value: m, label: m }))}
          />
        ) : (
          <TextInput value={cfg.model} onChange={v => update({ model: v })} placeholder="llama3.2" />
        )}
      </div>
    </div>
  );
}

function OpenAIConfigPanel({ creds, onChange }: {
  creds: ProviderCredentials;
  onChange: (c: ProviderCredentials) => void;
}) {
  const cfg = creds.openai ?? { apiKey: '', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' };
  const update = (patch: Partial<typeof cfg>) => onChange({ ...creds, openai: { ...cfg, ...patch } });

  const models = [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o3-mini', label: 'o3-mini' },
  ];

  return (
    <div className="space-y-2.5">
      <div>
        <FieldLabel>API Key</FieldLabel>
        <SecretInput value={cfg.apiKey} onChange={v => update({ apiKey: v })} placeholder="sk-..." />
      </div>
      <div>
        <FieldLabel>Model</FieldLabel>
        <SelectInput value={cfg.model} onChange={v => update({ model: v })} options={models} />
      </div>
      <div>
        <FieldLabel>Base URL (optional — for OpenRouter, Azure, etc.)</FieldLabel>
        <TextInput value={cfg.baseUrl} onChange={v => update({ baseUrl: v })} placeholder="https://api.openai.com/v1" />
      </div>
    </div>
  );
}

function BedrockConfigPanel({ creds, onChange }: {
  creds: ProviderCredentials;
  onChange: (c: ProviderCredentials) => void;
}) {
  const cfg = creds.bedrock ?? { accessKeyId: '', secretAccessKey: '', region: 'us-east-1', modelId: 'anthropic.claude-3-haiku-20240307-v1:0' };
  const update = (patch: Partial<typeof cfg>) => onChange({ ...creds, bedrock: { ...cfg, ...patch } });

  const models = [
    { value: 'anthropic.claude-3-haiku-20240307-v1:0', label: 'Claude 3 Haiku' },
    { value: 'anthropic.claude-3-sonnet-20240229-v1:0', label: 'Claude 3 Sonnet' },
    { value: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet v2' },
    { value: 'meta.llama3-8b-instruct-v1:0', label: 'Llama 3 8B' },
    { value: 'meta.llama3-70b-instruct-v1:0', label: 'Llama 3 70B' },
    { value: 'mistral.mixtral-8x7b-instruct-v0:1', label: 'Mixtral 8×7B' },
    { value: 'mistral.mistral-large-2402-v1:0', label: 'Mistral Large' },
  ];

  const regions = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'EU (Ireland)' },
    { value: 'eu-central-1', label: 'EU (Frankfurt)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  ];

  return (
    <div className="space-y-2.5">
      <div>
        <FieldLabel>Access Key ID</FieldLabel>
        <SecretInput value={cfg.accessKeyId} onChange={v => update({ accessKeyId: v })} placeholder="AKIA..." />
      </div>
      <div>
        <FieldLabel>Secret Access Key</FieldLabel>
        <SecretInput value={cfg.secretAccessKey} onChange={v => update({ secretAccessKey: v })} placeholder="wJal..." />
      </div>
      <div>
        <FieldLabel>Region</FieldLabel>
        <SelectInput value={cfg.region} onChange={v => update({ region: v })} options={regions} />
      </div>
      <div>
        <FieldLabel>Model</FieldLabel>
        <SelectInput value={cfg.modelId} onChange={v => update({ modelId: v })} options={models} />
      </div>
    </div>
  );
}

function GeminiConfigPanel({ creds, onChange }: {
  creds: ProviderCredentials;
  onChange: (c: ProviderCredentials) => void;
}) {
  const cfg = creds.gemini ?? { apiKey: '' };
  const update = (patch: Partial<typeof cfg>) => onChange({ ...creds, gemini: { ...cfg, ...patch } });

  return (
    <div className="space-y-2.5">
      <div>
        <FieldLabel>API Key</FieldLabel>
        <SecretInput value={cfg.apiKey} onChange={v => update({ apiKey: v })} placeholder="AIza..." />
      </div>
      <p className="text-[10px] text-zinc-600">Also loaded from VITE_GEMINI_API_KEY in .env.local</p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

interface ProviderSettingsProps {
  providerType: ProviderType;
  onProviderChange: (type: ProviderType) => void;
  credentials: ProviderCredentials;
  onCredentialsChange: (creds: ProviderCredentials) => void;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({
  providerType,
  onProviderChange,
  credentials,
  onCredentialsChange,
}) => {
  const [expandedConfig, setExpandedConfig] = useState<ProviderType | null>(null);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);

  // Check Ollama and fetch models
  useEffect(() => {
    const baseUrl = credentials.ollama?.baseUrl || 'http://localhost:11434';
    isOllamaAvailable(baseUrl).then(online => {
      setOllamaOnline(online);
      if (online) {
        listOllamaModels(baseUrl).then(setOllamaModels);
      }
    });
  }, [credentials.ollama?.baseUrl]);

  const handleSelect = (type: ProviderType) => {
    onProviderChange(type);
    // Auto-expand config for providers that need it
    const provider = PROVIDERS.find(p => p.type === type);
    if (provider?.hasConfig && type !== 'local') {
      setExpandedConfig(type);
    }
  };

  const handleCredsUpdate = (updated: ProviderCredentials) => {
    onCredentialsChange(updated);
    saveCredentials(updated);
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden max-h-[80vh] overflow-y-auto">
      <div className="px-3 py-2 border-b border-zinc-800">
        <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Analysis Engine</p>
      </div>

      {PROVIDERS.map((provider) => (
        <div key={provider.type}>
          {/* Provider button */}
          <button
            onClick={() => handleSelect(provider.type)}
            className={`w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/50 transition-colors ${
              providerType === provider.type ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''
            }`}
          >
            <span className={`${provider.iconColor} flex-shrink-0`}>{provider.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200">{provider.name}</p>
              <p className="text-[10px] text-zinc-500 truncate">
                {provider.description}
                {provider.type === 'ollama' && ollamaOnline === true && <span className="ml-1 text-emerald-400">● Online</span>}
                {provider.type === 'ollama' && ollamaOnline === false && <span className="ml-1 text-red-400">● Offline</span>}
              </p>
            </div>
            {provider.hasConfig && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedConfig(expandedConfig === provider.type ? null : provider.type);
                }}
                className="p-1 text-zinc-500 hover:text-zinc-300 rounded"
                title="Configure"
              >
                {expandedConfig === provider.type ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </button>

          {/* Expandable config section */}
          {provider.hasConfig && expandedConfig === provider.type && (
            <div className="px-3 pb-3 pt-1 bg-zinc-950/50 border-t border-zinc-800/50">
              {provider.type === 'ollama' && (
                <OllamaConfig
                  creds={credentials}
                  onChange={handleCredsUpdate}
                  ollamaOnline={ollamaOnline}
                  ollamaModels={ollamaModels}
                />
              )}
              {provider.type === 'openai' && (
                <OpenAIConfigPanel creds={credentials} onChange={handleCredsUpdate} />
              )}
              {provider.type === 'bedrock' && (
                <BedrockConfigPanel creds={credentials} onChange={handleCredsUpdate} />
              )}
              {provider.type === 'gemini' && (
                <GeminiConfigPanel creds={credentials} onChange={handleCredsUpdate} />
              )}
            </div>
          )}
        </div>
      ))}

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-zinc-800">
        <p className="text-[10px] text-zinc-600">
          Credentials stored in browser. Also supports .env.local vars.
        </p>
      </div>
    </div>
  );
};

export default ProviderSettings;
