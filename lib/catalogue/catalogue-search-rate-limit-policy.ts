export const catalogueSearchRateLimitMaximum = 120;
export const catalogueSearchRateLimitWindow = '1 m' as const;
export const catalogueSearchRateLimitWindowSeconds = 60;

export function catalogueSearchRetryAfterSeconds(
  resetAt: number | null | undefined,
  now = Date.now(),
) {
  if (typeof resetAt !== 'number' || !Number.isFinite(resetAt)) {
    return catalogueSearchRateLimitWindowSeconds;
  }

  return Math.min(
    catalogueSearchRateLimitWindowSeconds,
    Math.max(1, Math.ceil((resetAt - now) / 1_000)),
  );
}
