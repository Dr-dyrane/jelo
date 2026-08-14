import assert from "node:assert/strict";
import test from "node:test";
import {
  isSafeHostingerMailApiFallback,
  resolveHostingerMailboxResourceId,
  sendHostingerMailViaApi,
} from "@/lib/email/hostinger-mail-api";

test("Hostinger mailbox discovery selects the configured sender without exposing the token", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const resourceId = await resolveHostingerMailboxResourceId({
    apiToken: "mail-token",
    fromAddress: "hello@jelocare.com",
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        data: {
          mailboxes: [
            { resourceId: "AC_other", address: "team@jelocare.com" },
            { resourceId: "AC_hello", address: "Hello@JeloCare.com" },
          ],
        },
      });
    },
  });

  assert.equal(resourceId, "AC_hello");
  assert.equal(calls[0]?.url, "https://api.mail.hostinger.com/api/v1/me");
  assert.equal(
    new Headers(calls[0]?.init?.headers).get("authorization"),
    "Bearer mail-token",
  );
});

test("Hostinger API delivery follows the official send contract", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  await sendHostingerMailViaApi({
    apiToken: "mail-token",
    mailboxResourceId: "AC hello",
    to: "shop@example.com",
    displayName: "JeloCare",
    subject: "Continue your store",
    text: "Plain message",
    html: "<p>Message</p>",
    fetcher: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    },
  });

  const request = requests[0];
  assert.ok(request);
  assert.equal(
    request.url,
    "https://api.mail.hostinger.com/api/v1/mailboxes/AC%20hello/send",
  );
  assert.equal(request.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(request.init?.body)), {
    to: ["shop@example.com"],
    displayName: "JeloCare",
    subject: "Continue your store",
    text: "Plain message",
    html: "<p>Message</p>",
  });
});

test("a stale API token lookup is safe for SMTP fallback before delivery starts", async () => {
  await assert.rejects(
    resolveHostingerMailboxResourceId({
      apiToken: "stale-mail-token",
      fromAddress: "hello@jelocare.com",
      fetcher: async () => new Response(null, { status: 401 }),
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "hostinger_mail_account_401");
      assert.equal(
        (error as { deliveryAttempted: boolean }).deliveryAttempted,
        false,
      );
      assert.equal(isSafeHostingerMailApiFallback(error), true);
      return true;
    },
  );
});

test("Hostinger API delivery fails closed on provider errors", async () => {
  await assert.rejects(
    sendHostingerMailViaApi({
      apiToken: "mail-token",
      mailboxResourceId: "AC_hello",
      to: "shop@example.com",
      displayName: "JeloCare",
      subject: "Continue your store",
      text: "Plain message",
      html: "<p>Message</p>",
      fetcher: async () => Response.json({ error: "Denied" }, { status: 403 }),
    }),
    (error: unknown) => {
      assert.match((error as Error).message, /hostinger_mail_send_403/);
      assert.equal(
        (error as { deliveryAttempted: boolean }).deliveryAttempted,
        true,
      );
      assert.equal(isSafeHostingerMailApiFallback(error), true);
      return true;
    },
  );
});

test("an uncertain API POST is not marked safe for SMTP fallback", async () => {
  await assert.rejects(
    sendHostingerMailViaApi({
      apiToken: "mail-token",
      mailboxResourceId: "AC_hello",
      to: "shop@example.com",
      displayName: "JeloCare",
      subject: "Continue your store",
      text: "Plain message",
      html: "<p>Message</p>",
      fetcher: async () => {
        throw new Error("network interrupted");
      },
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "hostinger_mail_send_uncertain");
      assert.equal(
        (error as { deliveryAttempted: boolean }).deliveryAttempted,
        true,
      );
      assert.equal(isSafeHostingerMailApiFallback(error), false);
      return true;
    },
  );
});

test("a provider 5xx after the send request remains duplicate-safe and fail-closed", async () => {
  await assert.rejects(
    sendHostingerMailViaApi({
      apiToken: "mail-token",
      mailboxResourceId: "AC_hello",
      to: "shop@example.com",
      displayName: "JeloCare",
      subject: "Continue your store",
      text: "Plain message",
      html: "<p>Message</p>",
      fetcher: async () => new Response(null, { status: 503 }),
    }),
    (error: unknown) => {
      assert.equal((error as Error).message, "hostinger_mail_send_503");
      assert.equal(
        (error as { deliveryAttempted: boolean }).deliveryAttempted,
        true,
      );
      assert.equal(isSafeHostingerMailApiFallback(error), false);
      return true;
    },
  );
});
