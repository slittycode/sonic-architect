import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel from '../../components/ChatPanel';
import type { ReconstructionBlueprint } from '../../types';

const { sendMessageMock, clearHistoryMock } = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
  clearHistoryMock: vi.fn(),
}));

vi.mock('../../services/chatService', () => ({
  ClaudeChatService: class ClaudeChatServiceMock {
    sendMessage = sendMessageMock;
    clearHistory = clearHistoryMock;
  },
}));

vi.mock('../../services/geminiService', () => ({
  GeminiChatService: class GeminiChatServiceMock {
    sendMessage = sendMessageMock;
    clearHistory = clearHistoryMock;
  },
  parseGeminiEnhancement: vi.fn(),
  mergeGeminiEnhancement: vi.fn(),
}));

function makeBlueprint(): ReconstructionBlueprint {
  return {
    telemetry: {
      bpm: '128',
      key: 'F Minor',
      groove: 'Tight and punchy',
    },
    arrangement: [{ timeRange: '0:00-0:20', label: 'Intro', description: 'Sparse' }],
    instrumentation: [
      {
        element: 'Kick',
        timbre: 'Deep',
        frequency: '40-100Hz',
        abletonDevice: 'Drum Rack',
      },
    ],
    fxChain: [{ artifact: 'Low-end shaping', recommendation: 'EQ Eight low shelf' }],
    secretSauce: { trick: 'Ghost kick', execution: 'Sidechain subtle pump' },
  };
}

function createStringStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state and blueprint context badge', () => {
    render(<ChatPanel blueprint={makeBlueprint()} />);

    expect(screen.getByText(/Assistant/i)).toBeInTheDocument();
    expect(screen.getByText('Blueprint linked')).toBeInTheDocument();
    expect(screen.getByText(/Ask me anything about your audio analysis/i)).toBeInTheDocument();
  });

  it('streams assistant replies and updates the message list', async () => {
    sendMessageMock.mockResolvedValue(createStringStream(['Try ', 'OTT compression.']));
    const user = userEvent.setup();

    render(<ChatPanel blueprint={makeBlueprint()} />);

    const input = screen.getByPlaceholderText('Ask about your track...');
    await user.type(input, 'How can I add energy?');
    await user.click(screen.getByRole('button', { name: 'Send chat message' }));

    expect(sendMessageMock).toHaveBeenCalledWith('How can I add energy?');
    expect(screen.getByText('How can I add energy?')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Try OTT compression.')).toBeInTheDocument();
    });

    expect(input).toHaveValue('');
  });

  it('shows errors returned from the chat service', async () => {
    sendMessageMock.mockRejectedValue(new Error('Claude unavailable'));
    const user = userEvent.setup();

    render(<ChatPanel blueprint={makeBlueprint()} />);

    await user.type(screen.getByPlaceholderText('Ask about your track...'), 'Any mix advice?');
    await user.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(screen.getByText('Claude unavailable')).toBeInTheDocument();
    });
  });

  it('clears visible messages and chat history', async () => {
    sendMessageMock.mockResolvedValue(createStringStream(['Use subtle saturation.']));
    const user = userEvent.setup();

    render(<ChatPanel blueprint={makeBlueprint()} />);

    await user.type(screen.getByPlaceholderText('Ask about your track...'), 'Warmth tips?');
    await user.click(screen.getByRole('button', { name: 'Send chat message' }));
    await waitFor(() => {
      expect(screen.getByText('Use subtle saturation.')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Clear chat history' }));

    expect(clearHistoryMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Warmth tips?')).not.toBeInTheDocument();
    expect(screen.queryByText('Use subtle saturation.')).not.toBeInTheDocument();
    expect(screen.getByText(/Ask me anything about your audio analysis/i)).toBeInTheDocument();
  });

  it('resets visible chat history when blueprint context changes', async () => {
    sendMessageMock.mockResolvedValue(createStringStream(['Start with gentle compression.']));
    const user = userEvent.setup();
    const { rerender } = render(<ChatPanel blueprint={makeBlueprint()} />);

    await user.type(screen.getByPlaceholderText('Ask about your track...'), 'What should I try?');
    await user.click(screen.getByRole('button', { name: 'Send chat message' }));
    await waitFor(() => {
      expect(screen.getByText('Start with gentle compression.')).toBeInTheDocument();
    });

    rerender(<ChatPanel blueprint={null} />);

    expect(screen.queryByText('What should I try?')).not.toBeInTheDocument();
    expect(screen.queryByText('Start with gentle compression.')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Upload audio first to enable context')).toBeInTheDocument();
  });
});
