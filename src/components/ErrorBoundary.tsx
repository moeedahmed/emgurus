import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: any }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, info: any) { console.error('Exams ErrorBoundary', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto px-4 py-10">
          <div className="rounded-2xl border p-6 bg-accent/30">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">A runtime error occurred. You can try reloading the page.</p>
            <button className="px-4 py-2 rounded-md border" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
