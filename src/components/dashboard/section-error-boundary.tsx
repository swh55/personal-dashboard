"use client";

import * as React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; name?: string },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; name?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SectionErrorBoundary]", this.props.name, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              خطأ في تحميل القسم: {this.props.name || "غير معروف"}
            </p>
            <pre className="mt-2 max-h-96 overflow-auto text-left text-xs text-muted-foreground">
              {this.state.error?.message || "Unknown error"}
              {"\n\n"}
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
