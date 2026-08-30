"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Card } from "@/components/ui";

type Props = { children: ReactNode; name?: string };

type State = { error: Error | null };

export class TradeErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name ?? "Trade"}]`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Card title="Something broke on this page">
          <p className="mb-3 text-sm text-rose-400">{this.state.error.message}</p>
          <p className="mb-4 text-xs text-zinc-500">
            Try refresh (Ctrl+Shift+R). If it keeps happening, run{" "}
            <code className="text-zinc-300">scripts\dev-reset.ps1</code>
          </p>
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
        </Card>
      );
    }
    return this.props.children;
  }
}
