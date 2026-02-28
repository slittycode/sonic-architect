import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  declare props: Props;
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Render crash:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-8">
        <div className="max-w-lg w-full bg-zinc-900 border border-red-800/50 rounded-xl p-8 space-y-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <h1 className="text-xl font-bold text-red-200">Something went wrong</h1>
          </div>
          <div className="bg-zinc-950 rounded-lg p-4 overflow-auto max-h-48">
            <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">
              {this.state.error?.message || 'Unknown error'}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reload App
          </button>
        </div>
      </div>
    );
  }
}
