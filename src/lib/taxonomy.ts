export const CATEGORIES = [
  "General",
  "Exam Guidance",
  "Clinical Compendium",
  "Research & Evidence",
  "Careers",
  "Announcements",
] as const;

export type Category = typeof CATEGORIES[number];

export function sanitizeCategory(input?: string | null): Category {
  const norm = (input || "").trim().toLowerCase();
  const found = CATEGORIES.find(c => c.toLowerCase() === norm);
  return (found || "General") as Category;
}
