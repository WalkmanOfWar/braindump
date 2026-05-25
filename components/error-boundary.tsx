"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-destructive/30 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Coś poszło nie tak</h1>
          <p className="text-sm text-muted-foreground mb-1">
            Aplikacja napotkała nieoczekiwany błąd.
          </p>
          <code className="text-xs text-destructive/80 block mt-3 mb-5 px-3 py-2 bg-destructive/5 rounded-lg border border-destructive/20 break-words text-left">
            {this.state.error.message || "Nieznany błąd"}
          </code>
          <div className="flex gap-2">
            <Button onClick={this.reset} variant="outline" className="flex-1 gap-1.5">
              <RefreshCw className="w-4 h-4" />
              Spróbuj ponownie
            </Button>
            <Button onClick={() => location.href = "/dashboard"} className="flex-1">
              Wróć do dashboardu
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
