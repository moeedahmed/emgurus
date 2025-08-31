import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props { 
  children: ReactNode;
  tabId: string;
  onRetry?: () => void;
}

interface State { 
  hasError: boolean; 
  error?: any; 
}

export class TabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  
  static getDerivedStateFromError(error: any) { 
    return { hasError: true, error }; 
  }
  
  componentDidCatch(error: any, info: any) { 
    console.error(`Tab ${this.props.tabId} ErrorBoundary:`, error, info); 
  }
  
  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 text-center">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">This section had an error</h3>
              <p className="text-sm text-muted-foreground">
                Something went wrong while loading this tab.
              </p>
            </div>
            <Button onClick={this.handleRetry} variant="outline">
              Retry
            </Button>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}

export default TabErrorBoundary;