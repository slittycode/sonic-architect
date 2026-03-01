import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, MessageSquare, Trash2 } from 'lucide-react';
import { ReconstructionBlueprint, ProviderType } from '../types';
import { GeminiChatService } from '../services/gemini';

interface ChatPanelProps {
  blueprint: ReconstructionBlueprint | null;
  /** Active provider — determines which chat backend to use */
  providerType?: ProviderType;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// Shared interface both services satisfy
interface ChatService {
  sendMessage(text: string): Promise<ReadableStream<string>>;
  clearHistory(): void;
}

function providerLabel(providerType: ProviderType | undefined): string {
  if (providerType === 'gemini') return 'Gemini Assistant';
  return 'Production Assistant';
}

const ChatPanel: React.FC<ChatPanelProps> = ({ blueprint, providerType }) => {
  const hasGeminiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatServiceRef = useRef<ChatService | null>(null);

  useEffect(() => {
    const blueprintGetter = blueprint ? () => blueprint : null;

    setMessages([]);
    setError(null);

    // Always use Gemini chat service
    chatServiceRef.current = new GeminiChatService(blueprintGetter);
  }, [blueprint, providerType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setInput('');
    setLoading(true);
    setError(null);

    const userMessage: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);

    try {
      if (!chatServiceRef.current) {
        throw new Error('Chat service not initialized');
      }

      const stream = await chatServiceRef.current.sendMessage(trimmed);
      const reader = stream.getReader();
      let assistantMessage = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantMessage += value ?? '';
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1] = {
            role: 'assistant',
            content: assistantMessage,
          };
          return newMessages;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setError(null);
    chatServiceRef.current?.clearHistory();
  };

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-zinc-200">{providerLabel(providerType)}</h2>
          {blueprint && (
            <span className="text-[10px] px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full">
              Blueprint linked
            </span>
          )}
        </div>
        <button
          onClick={handleClear}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
          aria-label="Clear chat history"
          title="Clear chat history"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="h-80 overflow-y-auto p-4 space-y-4">
        {!hasGeminiKey ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2">
            <MessageSquare className="w-8 h-8 text-zinc-700" />
            <p className="text-sm text-zinc-500">Chat requires a Gemini API key.</p>
            <p className="text-xs text-zinc-600">
              Set <code className="text-zinc-500">VITE_GEMINI_API_KEY</code> in{' '}
              <code className="text-zinc-500">.env.local</code> to enable.
            </p>
          </div>
        ) : (
          <>
            {messages.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                <MessageSquare className="w-8 h-8 text-zinc-600" />
                <p className="text-sm text-zinc-500">Ask me anything about your audio analysis.</p>
                <p className="text-xs text-zinc-600">
                  {blueprint
                    ? 'I have access to your reconstruction blueprint.'
                    : 'Upload and analyze audio first to link the blueprint.'}
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-200'}`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 px-3 py-2 rounded-lg flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                  <span className="text-sm text-zinc-400">Thinking...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="bg-red-900/20 border border-red-800 px-3 py-2 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-3 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              blueprint ? 'Ask about your track...' : 'Upload audio first to enable context'
            }
            disabled={loading || !hasGeminiKey}
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !hasGeminiKey}
            aria-label="Send chat message"
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default ChatPanel;
