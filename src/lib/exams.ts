export function canonExamType(input?: string | null, choices?: readonly string[]): string | null {
  if (!input) return null;
  // If UI option values are already canonical labels (e.g., "MRCEM Intermediate SBA"), just return as-is.
  // If a slug sneaks in (e.g., "MRCEM_INTERMEDIATE_SBA"), normalize to "MRCEM Intermediate SBA".
  const deSlug = input.includes('_') ? input.replace(/_/g, ' ').trim() : input.trim();
  // Prefer an exact match from known choices (case-insensitive)
  if (Array.isArray(choices) && choices.length) {
    const found = choices.find(c => c.toLowerCase() === deSlug.toLowerCase());
    if (found) return found;
  }
  // Title-case words separated by spaces (best-effort)
  return deSlug.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function safeModeForAttempts(_requested?: string | null) {
  // The DB check constraint accepts "practice" or "exam" (rename of exam mode).
  return 'practice';
}