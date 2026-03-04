import { useState } from 'react';
import type { ProviderType } from '@/src/domain/providers/types';
import { GEMINI_MODEL_LABELS, type GeminiModelId } from '@/services/providers/gemini/client';

function getStoredProvider(): ProviderType {
  const hasGeminiKey =
    typeof import.meta.env.VITE_GEMINI_API_KEY === 'string' &&
    import.meta.env.VITE_GEMINI_API_KEY.length > 0;

  try {
    const stored = localStorage.getItem('sonic-architect-provider');
    if (stored === 'gemini' || stored === 'local') return stored as ProviderType;
  } catch {}

  return hasGeminiKey ? 'gemini' : 'local';
}

export function useProviderSettings() {
  const [providerType, setProviderType] = useState<ProviderType>(getStoredProvider);
  const [showSettings, setShowSettings] = useState(false);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [geminiModel, setGeminiModel] = useState<GeminiModelId>(() => {
    try {
      const stored = localStorage.getItem('sonic-architect-gemini-model');
      if (stored && stored in GEMINI_MODEL_LABELS) return stored as GeminiModelId;
    } catch {}
    return 'gemini-2.5-flash';
  });

  const handleProviderChange = (type: ProviderType) => {
    setProviderType(type);
    setProviderNotice(null);
    setShowSettings(false);
    try {
      localStorage.setItem('sonic-architect-provider', type);
    } catch {}
  };

  const handleGeminiModelChange = (model: GeminiModelId) => {
    setGeminiModel(model);
    try {
      localStorage.setItem('sonic-architect-gemini-model', model);
    } catch {}
  };

  return {
    providerType,
    setProviderType,
    showSettings,
    setShowSettings,
    providerNotice,
    setProviderNotice,
    geminiModel,
    handleProviderChange,
    handleGeminiModelChange,
  };
}
