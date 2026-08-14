import assert from "node:assert/strict";
import test from "node:test";

import { operatorOtpEmail } from "@/lib/email/templates";

test("the operator OTP email is responsive, theme-aware, and accessible", () => {
  const message = operatorOtpEmail({ code: "123456", type: "sign-in" });

  assert.equal(message.subject, "Your JeloCare sign-in code");
  assert.match(message.text, /Expires in 10 minutes\. Never share this code\./);
  assert.match(message.html, /^<!doctype html>/);
  assert.match(message.html, /<html lang="en">/);
  assert.match(message.html, /name="viewport"/);
  assert.match(message.html, /name="color-scheme" content="light dark"/);
  assert.match(message.html, /@media \(prefers-color-scheme: dark\)/);
  assert.match(message.html, /@media only screen and \(max-width: 480px\)/);
  assert.match(message.html, /role="presentation"/);
  assert.match(message.html, /class="otp-label"[^>]*>Your code</);
  assert.match(message.html, /<code class="otp-code" dir="ltr"/);
  assert.match(message.html, /color:#7a6b66/);
  assert.doesNotMatch(message.html, /color:#8a7d78/);
});

test("the operator OTP email escapes untrusted code content", () => {
  const message = operatorOtpEmail({ code: "<script>&\"'" });

  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;&amp;&quot;&#039;/);
});
