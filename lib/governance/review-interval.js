const MONTHS_DEFAULT = 12;
export function resolveReviewInterval({ version, category, businessUnit, systemDefaultMonths = MONTHS_DEFAULT }) {
  const selected = version.reviewIntervalMonths ? [version.reviewIntervalMonths, 'VERSION_OVERRIDE'] : category?.reviewIntervalMonths ? [category.reviewIntervalMonths, 'CATEGORY_CONFIGURATION'] : businessUnit?.defaultReviewIntervalMonths ? [businessUnit.defaultReviewIntervalMonths, 'BUSINESS_UNIT_CONFIGURATION'] : [systemDefaultMonths, 'SYSTEM_DEFAULT'];
  const [reviewIntervalMonths, reviewIntervalSource] = selected;
  if (!version.effectiveAt) return { reviewIntervalMonths, reviewIntervalSource, nextReviewAt: null };
  // Governance dates are stored as UTC timestamps; calendar month arithmetic preserves the business day.
  const nextReviewAt = new Date(version.effectiveAt);
  const day = nextReviewAt.getUTCDate();
  nextReviewAt.setUTCDate(1);
  nextReviewAt.setUTCMonth(nextReviewAt.getUTCMonth() + reviewIntervalMonths);
  const lastDay = new Date(Date.UTC(nextReviewAt.getUTCFullYear(), nextReviewAt.getUTCMonth() + 1, 0)).getUTCDate();
  nextReviewAt.setUTCDate(Math.min(day, lastDay));
  return { reviewIntervalMonths, reviewIntervalSource, nextReviewAt };
}
