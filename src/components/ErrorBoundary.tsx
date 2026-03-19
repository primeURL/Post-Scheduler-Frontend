import { Component, type ReactNode, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="rounded-xl p-4 my-4"
          style={{
            background: "rgba(240,112,80,0.1)",
            border: "1px solid rgba(240,112,80,0.3)",
          }}
        >
          <div className="flex items-start gap-3">
            <span
              className="material-symbols-outlined text-danger shrink-0"
              style={{ fontSize: 20 }}
            >
              error
            </span>
            <div>
              <h3 className="text-sm font-semibold text-danger mb-1">
                Something went wrong
              </h3>
              <p className="text-xs text-muted">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-danger/10"
                style={{ color: "#F07050", border: "1px solid rgba(240,112,80,0.3)" }}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
