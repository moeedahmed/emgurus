export const EXAM_ENUMS = ["MRCEM_PRIMARY","MRCEM_SBA","FRCEM_SBA","OTHER"] as const;
export type ExamEnum = typeof EXAM_ENUMS[number];

export const EXAM_LABEL_TO_ENUM: Record<string, ExamEnum> = {
  'MRCEM Primary': 'MRCEM_PRIMARY',
  'MRCEM Intermediate SBA': 'MRCEM_SBA', 
  'FRCEM SBA': 'FRCEM_SBA',
};

export function mapLabelToEnum(label?: string | null): ExamEnum {
  if (!label) return "OTHER";
  // Check direct mapping first
  if (EXAM_LABEL_TO_ENUM[label]) return EXAM_LABEL_TO_ENUM[label];
  
  // Fallback to original logic for partial matches
  const s = label.trim().toLowerCase();
  if (s.includes("primary")) return "MRCEM_PRIMARY";
  if (s.includes("frcem")) return "FRCEM_SBA";
  if (s.includes("intermediate") || (s.includes("sba") && s.includes("mrcem"))) return "MRCEM_SBA";
  return "OTHER";
}

export function mapEnumToLabel(v?: string | null): string {
  switch (v) {
    case "MRCEM_PRIMARY": return "MRCEM Primary";
    case "MRCEM_SBA":     return "MRCEM Intermediate SBA";
    case "FRCEM_SBA":     return "FRCEM SBA";
    default:              return "Other";
  }
}

export function safeMode(v?: string | null): "practice"|"exam" {
  return v === "exam" ? "exam" : "practice";
}

// Helper to build attempt breakdown with both label and enum
export function buildAttemptBreakdown(opts: {
  examLabel?: string | null;
  topic?: string | null;
  total?: number | null;
  timeLimitMin?: number | null;
}) {
  return {
    exam_label: opts.examLabel ?? null,          // for reviewed bank filter
    exam_type: mapLabelToEnum(opts.examLabel ?? ''), // for AI/analytics
    topic: opts.topic ?? null,
    total: opts.total ?? null,
    time_limit: opts.timeLimitMin ?? null,
  };
}

// Legacy compatibility
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