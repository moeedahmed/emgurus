// Feature flags for the application
export const FEATURE_FLAGS = {
  BLOG_EDITOR_V2: true,
  BLOG_DETAIL_V2: true,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag] ?? false;
}