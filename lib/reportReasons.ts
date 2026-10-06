export const REPORT_REASONS = [
  { label: 'Spam', value: 'spam' },
  { label: 'Inappropriate content', value: 'inappropriate' },
  { label: 'Not a pothole', value: 'not_pothole' },
  { label: 'Duplicate', value: 'duplicate' },
  { label: 'Other', value: 'other' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['value']
