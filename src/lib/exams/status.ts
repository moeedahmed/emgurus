export const REVIEW_STATUS = {
  DRAFT: 'draft',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const;

export function normalizeReviewStatus(value?: string) {
  switch (value) {
    case 'in_review':
    case 'pending_review':
      return REVIEW_STATUS.UNDER_REVIEW;
    case 'approved':
    case 'published':
    case 'approved_public':
      return REVIEW_STATUS.APPROVED;
    case 'rejected':
      return REVIEW_STATUS.REJECTED;
    case 'draft':
    default:
      return REVIEW_STATUS.DRAFT;
  }
}
