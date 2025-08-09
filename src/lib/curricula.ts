export const EXAMS = [
  "MRCEM Primary",
  "MRCEM Intermediate SBA",
  "FRCEM SBA",
] as const;

export type ExamName = typeof EXAMS[number];

export const CURRICULA: Record<ExamName, string[]> = {
  "MRCEM Primary": ["Anatomy", "Physiology", "Pharmacology", "Microbiology", "Pathology"],
  "MRCEM Intermediate SBA": ["Cardiology", "Respiratory", "Neurology", "Gastro", "Renal/Urology", "EM Procedures", "Toxicology"],
  "FRCEM SBA": ["Resuscitation", "Critical Care", "Trauma", "Pediatrics", "Toxicology", "Procedures", "Ethics/Governance"],
};
