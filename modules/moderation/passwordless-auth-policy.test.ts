import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isBlockedPasswordAuthPath } from "../../lib/auth/passwordless-policy";

test("passwordless auth policy blocks credential and password lifecycle routes", () => {
  for (const path of [
    ["sign-up", "email"],
    ["sign-in", "email"],
    ["forget-password"],
    ["request-password-reset"],
    ["reset-password"],
    ["email-otp", "reset-password"],
    ["change-password"],
    ["set-password"],
  ]) {
    assert.equal(isBlockedPasswordAuthPath(path), true, path.join("/"));
  }
});

test("passwordless auth policy preserves the OTP session lifecycle", () => {
  for (const path of [
    ["sign-in", "email-otp"],
    ["email-otp", "send-verification-otp"],
    ["email-otp", "check-verification-otp"],
    ["email-otp", "verify-email"],
    ["get-session"],
    ["sign-out"],
  ]) {
    assert.equal(isBlockedPasswordAuthPath(path), false, path.join("/"));
  }
});

test("the public auth proxy applies the passwordless policy before the managed handler", () => {
  const source = readFileSync(
    new URL("../../app/api/auth/[...path]/route.ts", import.meta.url),
    "utf8",
  );

  const policyIndex = source.indexOf("isBlockedPasswordAuthPath(path)");
  const handlerIndex = source.indexOf("getAuth().handler()");

  assert.ok(policyIndex >= 0);
  assert.ok(handlerIndex > policyIndex);
  assert.match(source, /["']Cache-Control["']:\s*["']private, no-store["']/);
});
