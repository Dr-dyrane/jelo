const MAX_NGN_AMOUNT = 100_000_000;
const NGN_DECIMAL = /^(0|[1-9]\d{0,8})(?:\.(\d{1,2}))?$/;

/**
 * Normalize a database or application money value without silently rounding
 * fractions of a kobo. PostgreSQL numeric values arrive as strings by default.
 */
function parseNgnKobo(value: unknown): number {
  const normalized =
    typeof value === "string"
      ? value.trim()
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : null;
  if (!normalized) {
    throw new Error("Invalid NGN amount.");
  }
  const match = NGN_DECIMAL.exec(normalized);
  if (!match) {
    throw new Error("Invalid NGN amount.");
  }

  const major = Number(match[1]);
  const minor = Number((match[2] ?? "").padEnd(2, "0"));
  const kobo = major * 100 + minor;
  if (!Number.isSafeInteger(kobo) || kobo <= 0 || kobo > MAX_NGN_AMOUNT * 100) {
    throw new Error("Invalid NGN amount.");
  }

  return kobo;
}

export function normalizeNgnAmount(value: unknown): number {
  return parseNgnKobo(value) / 100;
}

export function ngnToKobo(value: unknown): number {
  return parseNgnKobo(value);
}

export function normalizeKoboAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number.NaN;
  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    amount > MAX_NGN_AMOUNT * 100
  ) {
    throw new Error("Invalid kobo amount.");
  }
  return amount;
}
