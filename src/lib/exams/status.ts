export const REVIEW_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

export function normalizeReviewStatus(s?: string) {
  if (s === 'in_review') return 'under_review';
  return s ?? '';
}
