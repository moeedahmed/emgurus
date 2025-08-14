import React from 'react';

export const SafeMount: React.FC<{ 
  component: React.ComponentType<any>, 
  props?: any, 
  fallbackText?: string 
}> = ({ component: Cmp, props, fallbackText }) => {
  try {
    return <Cmp {...(props || {})} />;
  } catch (e) {
    console.error('SafeMount caught error:', e);
    return (
      <div className="text-sm text-muted-foreground p-6 border rounded-lg">
        {fallbackText || 'This panel failed to load.'}
      </div>
    );
  }
};