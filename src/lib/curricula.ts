// DEPRECATED: Use @/lib/examMapping instead
// This file is kept for backward compatibility only

import { 
  EXAM_DISPLAY_NAMES, 
  CURRICULA as NEW_CURRICULA, 
  type ExamDisplayName 
} from '@/lib/examMapping';

// Re-export with old names for backward compatibility
export const EXAMS = EXAM_DISPLAY_NAMES;
export type ExamName = ExamDisplayName;
export const CURRICULA = NEW_CURRICULA;

// Mark as deprecated in console
console.warn(
  'DEPRECATED: @/lib/curricula is deprecated. Use @/lib/examMapping instead. ' +
  'Please update your imports to use the new standardized exam mapping.'
);