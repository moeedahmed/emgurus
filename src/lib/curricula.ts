export const EXAMS = [
  "MRCEM Primary",
  "MRCEM Intermediate SBA", 
  "FRCEM SBA",
  "FCPS Part 1 – Pakistan",
  "FCPS IMM – Pakistan", 
  "FCPS Part 2 – Pakistan",
] as const;

export type ExamName = typeof EXAMS[number];

export const CURRICULA: Record<ExamName, string[]> = {
  "MRCEM Primary": ["Anatomy", "Physiology", "Pharmacology", "Microbiology", "Pathology"],
  "MRCEM Intermediate SBA": ["Cardiology", "Respiratory", "Neurology", "Gastro", "Renal/Urology", "EM Procedures", "Toxicology"],
  "FRCEM SBA": ["Resuscitation", "Critical Care", "Trauma", "Pediatrics", "Toxicology", "Procedures", "Ethics/Governance"],
  "FCPS Part 1 – Pakistan": ["Basic Sciences", "Anatomy", "Physiology", "Pathology", "Pharmacology"],
  "FCPS IMM – Pakistan": ["Emergency Medicine", "Internal Medicine", "Cardiology", "Respiratory", "Neurology"],
  "FCPS Part 2 – Pakistan": ["Clinical Medicine", "Surgery", "Pediatrics", "Obstetrics", "Psychiatry"],
};
