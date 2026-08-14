import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  OTP_RESEND_COOLDOWN_MS,
  otpResendSeconds,
  otpSignInErrorMessage,
} from "../../lib/auth/otp-sign-in";

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("OTP sign-in prevents duplicate requests and makes resend deliberate", async () => {
  const page = await readSource("app/(auth)/sign-in/page.tsx");

  assert.equal(OTP_RESEND_COOLDOWN_MS, 60_000);
  assert.equal(otpResendSeconds(61_000, 1_000), 60);
  assert.equal(otpResendSeconds(61_000, 61_001), 0);
  assert.match(page, /const sendInFlight = useRef\(false\)/);
  assert.match(page, /const verifyInFlight = useRef\(false\)/);
  assert.match(
    page,
    /!normalizedEmail \|\| sendInFlight\.current \|\| verifyInFlight\.current/,
  );
  assert.match(page, /sendInFlight\.current = true;[\s\S]*setBusy\(true\)/);
  assert.match(page, /Date\.now\(\) < resendAvailableAt/);
  assert.match(page, /disabled=\{busy \|\| resendSeconds > 0\}/);
  assert.match(page, /`Resend in \$\{resendSeconds\}s`/);
  assert.match(page, /A new code was requested\. Use the newest code\./);
  assert.equal(
    otpSignInErrorMessage({ status: 429 }, "send"),
    "Too many code requests. Wait a moment, then try again.",
  );
});

test("OTP sign-in is truthful, autofill-friendly, and quietly recoverable", async () => {
  const [page, css, layout] = await Promise.all([
    readSource("app/(auth)/sign-in/page.tsx"),
    readSource("app/(auth)/sign-in/sign-in.module.css"),
    readSource("app/(auth)/layout.tsx"),
  ]);

  assert.match(page, /Check \{email\}/);
  assert.match(page, /Enter the newest code from your inbox\./);
  assert.match(page, /Nothing yet\? Check spam, then request a new code\./);
  assert.doesNotMatch(page, /Code sent|Sent to \{email\}/);
  assert.match(page, /inputMode="numeric"/);
  assert.match(page, /autoComplete="one-time-code"/);
  assert.match(page, /replace\(\/\\D\/g,\s*["']["']\)[\s\S]*slice\(0, 6\)/);
  assert.match(page, /nextVal\.length === 6[\s\S]*verifyCode/);
  assert.equal(
    otpSignInErrorMessage({ code: "OTP_EXPIRED" }, "verify"),
    "That code has expired. Request a new one.",
  );
  assert.equal(
    otpSignInErrorMessage({ status: 400 }, "verify"),
    "That code did not match. Check the newest code and try again.",
  );
  assert.match(page, /aria-describedby=\{/);
  assert.match(css, /\.meta[\s\S]*flex-wrap:\s*wrap/);
  assert.match(css, /\.guidance[\s\S]*line-height:\s*1\.5/);
  assert.match(layout, /Sign in · JeloCare["']/);
  assert.doesNotMatch(layout, /Sign in · JeloCare Ops/);
});
