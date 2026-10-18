import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/Button';

interface State {
  failed: boolean;
}

/** Stops one broken screen from blanking the whole app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto my-16 max-w-md rounded-panel border border-sand bg-[#fffdfb] p-8 text-center shadow-panel">
        <h2 className="font-display text-3xl text-plum-900">This page ran into a problem</h2>
        <p className="mt-2 text-sm text-ink-mute">Your data is safe. Reload to try again, or go back to the dashboard.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => window.location.reload()}>Reload page</Button>
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = '/dashboard';
            }}
          >
            Go to dashboard
          </Button>
        </div>
      </div>
    );
  }
}
