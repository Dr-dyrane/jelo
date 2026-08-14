export function providerSettlementDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds) : null;
}

export function boundedPaymentEvidenceText(
  value: unknown,
  maximumLength = 200,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maximumLength);
}
