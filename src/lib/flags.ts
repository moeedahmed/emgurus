// Feature flags for safe production deployment
// Environment variables are checked at build time, defaults to false

export function isExamsV2Enabled(): boolean {
  return import.meta.env.VITE_ENABLE_EXAMS_V2 === 'true';
}

export function isBlogsV2Enabled(): boolean {
  return import.meta.env.VITE_ENABLE_BLOGS_V2 === 'true';
}