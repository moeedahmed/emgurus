// Central exam mapping utilities for database standardization
import type { Database } from '@/integrations/supabase/types';

export type ExamTypeEnum = Database['public']['Enums']['exam_type_enum'];

// Display names for exams (used in UI components)
export const EXAM_DISPLAY_NAMES = [
  "MRCEM Primary",
  "MRCEM Intermediate SBA", 
  "FRCEM SBA",
  "FCPS Part 1 – Pakistan",
  "FCPS IMM – Pakistan", 
  "FCPS Part 2 – Pakistan",
  "Other",
] as const;

export type ExamDisplayName = typeof EXAM_DISPLAY_NAMES[number];

// Mapping from display names to database enum values
export const EXAM_DISPLAY_TO_ENUM: Record<ExamDisplayName, ExamTypeEnum> = {
  "MRCEM Primary": "MRCEM_PRIMARY",
  "MRCEM Intermediate SBA": "MRCEM_SBA",
  "FRCEM SBA": "FRCEM_SBA",
  "FCPS Part 1 – Pakistan": "FCPS_PART1",
  "FCPS IMM – Pakistan": "FCPS_IMM",
  "FCPS Part 2 – Pakistan": "FCPS_PART2",
  "Other": "OTHER",
};

// Mapping from database enum values to display names
export const EXAM_ENUM_TO_DISPLAY: Record<ExamTypeEnum, ExamDisplayName> = {
  "MRCEM_PRIMARY": "MRCEM Primary",
  "MRCEM_SBA": "MRCEM Intermediate SBA",
  "FRCEM_SBA": "FRCEM SBA",
  "FCPS_PART1": "FCPS Part 1 – Pakistan",
  "FCPS_IMM": "FCPS IMM – Pakistan",
  "FCPS_PART2": "FCPS Part 2 – Pakistan",
  "OTHER": "Other",
};

// Legacy slug mappings for backward compatibility
export const EXAM_SLUG_TO_ENUM: Record<string, ExamTypeEnum> = {
  'mrcem-primary': 'MRCEM_PRIMARY',
  'mrcem-sba': 'MRCEM_SBA', 
  'frcem-sba': 'FRCEM_SBA',
  'fcps-part1': 'FCPS_PART1',
  'fcps-part1-pk': 'FCPS_PART1',
  'fcps-part2': 'FCPS_PART2',
  'fcps-part2-pk': 'FCPS_PART2',
  'fcps-imm': 'FCPS_IMM',
  'fcps-imm-pk': 'FCPS_IMM',
  'fcps-em-pk': 'FCPS_IMM',
  'fcps-emergency-medicine': 'FCPS_IMM'
};

// Curriculum mapping (kept for backward compatibility)
export const CURRICULA: Record<ExamDisplayName, string[]> = {
  "MRCEM Primary": ["Anatomy", "Physiology", "Pharmacology", "Microbiology", "Pathology"],
  "MRCEM Intermediate SBA": ["Cardiology", "Respiratory", "Neurology", "Gastro", "Renal/Urology", "EM Procedures", "Toxicology"],
  "FRCEM SBA": ["Resuscitation", "Critical Care", "Trauma", "Pediatrics", "Toxicology", "Procedures", "Ethics/Governance"],
  "FCPS Part 1 – Pakistan": ["Basic Sciences", "Anatomy", "Physiology", "Pathology", "Pharmacology"],
  "FCPS IMM – Pakistan": ["Emergency Medicine", "Internal Medicine", "Cardiology", "Respiratory", "Neurology"],
  "FCPS Part 2 – Pakistan": ["Clinical Medicine", "Surgery", "Pediatrics", "Obstetrics", "Psychiatry"],
  "Other": ["General Medicine", "General Surgery", "Basic Sciences"],
};

// Utility functions
export function mapDisplayNameToEnum(displayName: ExamDisplayName): ExamTypeEnum {
  return EXAM_DISPLAY_TO_ENUM[displayName];
}

export function mapEnumToDisplayName(enumValue: ExamTypeEnum): ExamDisplayName {
  return EXAM_ENUM_TO_DISPLAY[enumValue];
}

export function mapSlugToEnum(slug: string): ExamTypeEnum {
  return EXAM_SLUG_TO_ENUM[slug.toLowerCase()] || 'OTHER';
}

export function getAllExamEnums(): ExamTypeEnum[] {
  return Object.values(EXAM_DISPLAY_TO_ENUM);
}

export function getAllExamDisplayNames(): ExamDisplayName[] {
  return EXAM_DISPLAY_NAMES.slice();
}

// For components that need the old EXAMS export
export const EXAMS = EXAM_DISPLAY_NAMES;
export type ExamName = ExamDisplayName;