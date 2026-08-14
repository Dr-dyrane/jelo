export const OTP_RESEND_COOLDOWN_MS = 60_000;

type OtpAction = "send" | "verify";

export function otpSignInErrorMessage(
  error: unknown,
  action: OtpAction,
): string {
  const detail = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  } | null;
  const status = typeof detail?.status === "number" ? detail.status : null;
  const code =
    typeof detail?.code === "string" ? detail.code.toLowerCase() : "";
  const message =
    typeof detail?.message === "string" ? detail.message.toLowerCase() : "";
  const reason = `${code} ${message}`;

  if (status === 404)
    return "Sign-in is not switched on yet. Try again shortly.";
  if (status === 429) {
    return action === "send"
      ? "Too many code requests. Wait a moment, then try again."
      : "Too many attempts. Wait a moment, then try again.";
  }
  if (action === "verify" && reason.includes("expired")) {
    return "That code has expired. Request a new one.";
  }
  if (
    action === "verify" &&
    (status === 400 ||
      status === 401 ||
      reason.includes("invalid") ||
      reason.includes("otp"))
  ) {
    return "That code did not match. Check the newest code and try again.";
  }
  return action === "send"
    ? "Could not request a code. Try again in a moment."
    : "Could not verify that code. Check the newest code and try again.";
}

export function otpResendSeconds(
  availableAt: number,
  now = Date.now(),
): number {
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}
