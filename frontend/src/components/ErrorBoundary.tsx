'use client';

import { Component, type ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  title?: string;
  body?: string;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-line bg-card px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-pill bg-green-50 text-green-900">
            <TriangleAlert className="size-6" />
          </span>
          <div>
            <p className="text-base font-semibold text-ink-900">
              {this.props.title ?? 'This screen ran into a problem'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-ink-500">
              {this.props.body ?? 'You can reload this section and keep working.'}
            </p>
          </div>
          <Button variant="outline" onClick={this.reset}>
            <RefreshCw className="size-4" /> Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
