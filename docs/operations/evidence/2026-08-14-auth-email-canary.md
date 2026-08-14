# Production authentication email canary

Date: 2026-08-14
Result: **FAIL**

This is a redacted operator receipt. It contains no recipient address, OTP,
provider credential, private session value, or message identifier.

## Tested path

1. Confirmed `GET https://www.jelocare.com/api/auth-hooks` returned `ok: true`,
   `configured: true`, and `emailDeliveryConfigured: true`.
2. Opened a fresh signed-out production session at `/sign-in?next=/me`.
3. Submitted the approved connected mailbox once at
   `2026-08-14T18:13:05.787Z`.
4. Confirmed the UI advanced to the six-digit code screen and reported that the
   code was sent.
5. Queried the connected mailbox across all mail, including spam and trash,
   without pressing **Resend code**.

## Evidence and decision

No new JeloCare message was present after 140 seconds. The canary therefore
failed the handbook's 90-second receipt-and-verification requirement. No OTP
was entered, `/me` authentication was not claimed, and no second message was
requested.

The health response proves configuration presence only. The code-entry screen
proves the Auth request completed from the browser's perspective only. Neither
proves mailbox receipt. A later arrival does not change this canary result.

## Required retest

After the provider delivery fault is corrected, run exactly one new production
canary using the procedure in
[Custom JeloCare authentication email](../CUSTOM_AUTH_EMAIL.md#production-verification).
Pass only if the new message arrives and the code opens `/me` within 90 seconds.
