const PASSWORDLESS_ROUTE_EXCEPTIONS = new Set([
  "sign-in/email-otp",
  "email-otp/send-verification-otp",
  "email-otp/check-verification-otp",
  "email-otp/verify-email",
]);

/**
 * JeloCare's public auth contract is passwordless. Keep OTP endpoints available,
 * while failing closed if Managed Better Auth exposes credential routes now or
 * adds another password-named route in a future SDK release.
 */
export function isBlockedPasswordAuthPath(path: readonly string[]): boolean {
  const normalized = path
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean)
    .join("/");

  if (PASSWORDLESS_ROUTE_EXCEPTIONS.has(normalized)) return false;

  return (
    normalized === "sign-up/email" ||
    normalized === "sign-in/email" ||
    normalized.split("/").some((segment) => segment.includes("password"))
  );
}
