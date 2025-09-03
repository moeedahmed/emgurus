export type ModeKey = "practice" | "ai" | "exam";

export const MODE_LABEL: Record<ModeKey, string> = {
  practice: "Study Mode",     // formerly Practice Mode
  ai: "AI Practice",
  exam: "Exam Mode",
};

export const SHOW_GURU: Record<ModeKey, boolean> = {
  practice: true,
  ai: false,
  exam: false,
};