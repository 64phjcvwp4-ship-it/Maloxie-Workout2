import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { MaloxieButton } from './ui/MaloxieButton';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        readable = `${parsed.error} (${parsed.operationType ?? 'operation'} at ${parsed.path ?? 'database'})`;
      }
    } catch {
      // Keep raw error message
    }
    return { hasError: true, errorMessage: readable };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Maloxie ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#08080A] text-[#F5F5F7] flex items-center justify-center p-6">
          <div className="max-w-lg w-full maloxie-block p-8 space-y-4">
            <p className="text-xs font-medium tracking-[0.08em] uppercase text-[#E89B3C]">Application Recovery</p>
            <h1 className="text-2xl font-display font-semibold tracking-[-0.025em]">Something went wrong</h1>
            <p className="text-sm text-[#9A9AA6] leading-relaxed break-words">
              {this.state.errorMessage}
            </p>
            <MaloxieButton
              variant="primary"
              size="md"
              onClick={() => window.location.reload()}
            >
              Reload Maloxie
            </MaloxieButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
