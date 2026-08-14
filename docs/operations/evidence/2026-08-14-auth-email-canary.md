# Production authentication email canaries

Date: 2026-08-14
Result: **initial FAIL; recovery PASS**

This is a redacted operator receipt. It contains no recipient address, OTP,
provider credential, private session value, or message identifier.

## Initial canary — fail

1. Confirmed `GET https://www.jelocare.com/api/auth-hooks` returned `ok: true`,
   `configured: true`, and `emailDeliveryConfigured: true`.
2. Opened a fresh signed-out production session at `/sign-in?next=/me`.
3. Submitted the approved connected mailbox once at
   `2026-08-14T18:13:05.787Z`.
4. Confirmed the UI advanced to the six-digit code screen and reported that the
   code was sent.
5. Queried the connected mailbox across all mail, including spam and trash,
   without pressing **Resend code**.

### Evidence and decision

No new JeloCare message was present after 140 seconds. The canary therefore
failed the handbook's 90-second receipt-and-verification requirement. No OTP
was entered, `/me` authentication was not claimed, and no second message was
requested.

The health response proves configuration presence only. The code-entry screen
proves the Auth request completed from the browser's perspective only. Neither
proves mailbox receipt. The later arrival does not change this canary result.

### Root cause confirmed after the failed window

The delayed message's redacted original headers established this boundary:

- JeloCare requested the code at `18:13:05.787Z`;
- Hostinger accepted it from JeloCare at `18:13:08Z`;
- Hostinger did not release it to its outbound MailChannels path until
  `18:56:14Z`; and
- Gmail accepted it at `18:56:16Z`, with SPF, DKIM, and DMARC passing.

The roughly 43-minute hold was inside Hostinger, before MailChannels and Gmail.
It coincided with Hostinger's official
[Email Service Degraded Performance incident](https://statuspage.hostinger.com/incidents/zrcqt2jy3pt9),
which began at `16:28Z`, explicitly reported delayed messages safely queued,
and was resolved at `19:26:28Z`. This was a provider queue incident, not a
JeloCare template, DNS-authentication, Gmail, or Neon OTP-generation failure.

## Recovery canary — pass

One fresh, signed-out production canary was run without pressing resend:

1. The request started at `19:07:01.811Z`.
2. Hostinger accepted the message at `19:07:03Z` and released it downstream at
   `19:07:05Z`.
3. Gmail accepted it at `19:07:06–07Z`; one new JeloCare message was visible,
   with no duplicate.
4. The new code was entered once and the same browser opened the authenticated
   `/me` route.

The recovery canary therefore passed: external mailbox receipt took about five
seconds and the code completed the real session journey. The controlled
operator workflow, including private code retrieval and browser entry, took
42.1 seconds end to end.

## Operating decision

The production path was healthy at the recovery canary and the provider
incident is resolved. This is evidence for that measured window, not a promise
that Hostinger will always deliver within 90 seconds. Keep the 90-second
mailbox-and-verification canary as JeloCare's release gate, check the provider
status during incidents, and never treat API acceptance as mailbox receipt.
