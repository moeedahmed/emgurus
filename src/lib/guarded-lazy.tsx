import { lazy, Suspense, ComponentType } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { FeatureDisabled } from "@/components/common/FeatureDisabled";

// Loading fallback component
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

interface GuardedLazyProps {
  enabled: boolean;
  featureName: string;
  description?: string;
  importPath: () => Promise<{ default: ComponentType<any> }>;
}

/**
 * GuardedLazy - Prevents lazy loading when feature flag is disabled
 * Only calls lazy() and imports the module when enabled is true
 */
export function GuardedLazy({ enabled, featureName, description, importPath }: GuardedLazyProps) {
  // If disabled, return FeatureDisabled immediately without importing
  if (!enabled) {
    return <FeatureDisabled featureName={featureName} description={description} />;
  }

  // Only create the lazy component when enabled
  const LazyComponent = lazy(importPath);

  return (
    <ErrorBoundary fallback={<div>Something went wrong loading this feature.</div>}>
      <Suspense fallback={<PageLoadingFallback />}>
        <LazyComponent />
      </Suspense>
    </ErrorBoundary>
  );
}