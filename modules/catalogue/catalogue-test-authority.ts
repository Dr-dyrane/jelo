export const catalogueCompilationAuditMarginMs = 60_000;

function collectAuthorityTimestamps(
  value: unknown,
  timestamps: number[],
  fieldName?: string,
) {
  if (typeof value === 'string') {
    if (!fieldName?.endsWith('At')) return;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) timestamps.push(timestamp);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectAuthorityTimestamps(child, timestamps, fieldName);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    collectAuthorityTimestamps(child, timestamps, key);
  }
}

export function catalogueCompilationAuditBoundary(
  checkedInAuthorities: readonly unknown[],
) {
  const timestamps: number[] = [];
  for (const authority of checkedInAuthorities) {
    collectAuthorityTimestamps(authority, timestamps);
  }
  if (!timestamps.length) {
    throw new Error('Checked-in catalogue authorities contain no ISO audit timestamps.');
  }
  return Math.max(...timestamps) + catalogueCompilationAuditMarginMs;
}
