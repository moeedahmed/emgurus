import React from 'react';

export default class WorkspaceErrorBoundary extends React.Component<
  { children: React.ReactNode }, { err?: any }
> {
  state = { err: undefined as any };
  
  static getDerivedStateFromError(err: any) { 
    return { err }; 
  }
  
  componentDidCatch(err: any, info: any) { 
    console.error('Workspace crashed:', err, info); 
  }
  
  render() {
    if (this.state.err) {
      return (
        <div className="p-4 rounded-md border bg-amber-50 text-amber-900">
          <div className="font-semibold">Panel failed to load</div>
          <div className="text-sm mt-1">{String(this.state.err?.message || this.state.err)}</div>
        </div>
      );
    }
    return this.props.children as any;
  }
}