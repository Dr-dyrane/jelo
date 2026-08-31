import assert from "node:assert/strict";
import test from "node:test";
import {
  sendCampaignExceptionAlert,
  sendCampaignNoCandidateAlertIfNeeded,
  type CampaignExceptionAlertDependencies,
} from "@/lib/campaigns/campaign-alerting";

const checkedAt = "2026-08-17T07:01:00.000Z";

test("an empty ranked pool still raises a visible warning", async () => {
  const alert = await sendCampaignNoCandidateAlertIfNeeded(checkedAt, []);
  assert.ok(alert);
  assert.equal(alert.severity, "warning");
  assert.equal(alert.rejectedCandidateCount, 0);
  assert.match(alert.message, /ranked pool was empty/i);
});

test("warning alert when a small number of candidates were rejected", async () => {
  const alert = await sendCampaignNoCandidateAlertIfNeeded(checkedAt, [
    { slug: "product-a", blocker: "sent-within-14-day-cooldown" },
    { slug: "product-b", blocker: "no-fresh-shareable-ng-offer" },
  ]);
  assert.ok(alert);
  assert.equal(alert!.severity, "warning");
  assert.equal(alert!.rejectedCandidateCount, 2);
  assert.equal(alert!.event, "daily_campaign_no_candidate");
  assert.deepEqual(alert!.blockerBreakdown, {
    "sent-within-14-day-cooldown": 1,
    "no-fresh-shareable-ng-offer": 1,
  });
});

test("critical alert when rejection count exceeds the systemic threshold", async () => {
  const rejected = Array.from({ length: 120 }, (_, i) => ({
    slug: `product-${i}`,
    blocker: "live-product-dossier-identity-drift",
  }));
  const alert = await sendCampaignNoCandidateAlertIfNeeded(checkedAt, rejected);
  assert.ok(alert);
  assert.equal(alert!.severity, "critical");
  assert.equal(alert!.rejectedCandidateCount, 120);
  assert.equal(
    alert!.blockerBreakdown["live-product-dossier-identity-drift"],
    120,
  );
});

test("topRejected is capped at 20 entries", async () => {
  const rejected = Array.from({ length: 50 }, (_, i) => ({
    slug: `product-${i}`,
    blocker: "no-fresh-shareable-ng-offer",
  }));
  const alert = await sendCampaignNoCandidateAlertIfNeeded(checkedAt, rejected);
  assert.ok(alert);
  assert.equal(alert!.topRejected.length, 20);
});

test("blocker breakdown counts are aggregated correctly", async () => {
  const alert = await sendCampaignNoCandidateAlertIfNeeded(checkedAt, [
    { slug: "a", blocker: "cooldown" },
    { slug: "b", blocker: "cooldown" },
    { slug: "c", blocker: "cooldown" },
    { slug: "d", blocker: "drift" },
    { slug: "e", blocker: "drift" },
  ]);
  assert.ok(alert);
  assert.deepEqual(alert!.blockerBreakdown, {
    cooldown: 3,
    drift: 2,
  });
});

function exceptionAlertDependencies(
  overrides: Partial<CampaignExceptionAlertDependencies> = {},
): CampaignExceptionAlertDependencies {
  return {
    hasMailConfig: () => true,
    sendMail: async () => undefined,
    logMailFailure: () => undefined,
    sendTimeoutMs: 5_000,
    ...overrides,
  };
}

test("configured mail sends one critical production exception alert", async () => {
  const deliveries: Parameters<
    CampaignExceptionAlertDependencies["sendMail"]
  >[0][] = [];
  const alert = await sendCampaignExceptionAlert(
    "campaign-run-failed",
    checkedAt,
    exceptionAlertDependencies({
      sendMail: async (message) => {
        deliveries.push(message);
      },
    }),
  );

  assert.equal(deliveries.length, 1);
  assert.match(deliveries[0]!.subject, /critical/i);
  assert.match(deliveries[0]!.text, /Mode: production/);
  assert.equal(alert.mode, "production");
  assert.deepEqual(Object.keys(alert).sort(), [
    "failureCode",
    "message",
    "mode",
    "timestamp",
  ]);
});

test("production exception alert skips mail when transactional mail is unavailable", async () => {
  let sends = 0;
  const alert = await sendCampaignExceptionAlert(
    "campaign-run-failed",
    checkedAt,
    exceptionAlertDependencies({
      hasMailConfig: () => false,
      sendMail: async () => {
        sends += 1;
      },
    }),
  );

  assert.equal(sends, 0);
  assert.equal(alert.failureCode, "campaign-run-failed");
});

test("production exception alert sanitizes and bounds an unsafe failure code", async () => {
  const unsafeCode = `  Database <user@example.com> said: ${"X".repeat(100)}  `;
  const alert = await sendCampaignExceptionAlert(
    unsafeCode,
    checkedAt,
    exceptionAlertDependencies({ hasMailConfig: () => false }),
  );

  assert.match(alert.failureCode, /^[a-z0-9_-]+$/);
  assert.ok(alert.failureCode.length <= 80);
  assert.doesNotMatch(alert.failureCode, /[<>@.:\s]/);
  assert.doesNotMatch(alert.failureCode, /user|example|database/);
});

test("production exception alert absorbs provider failure and logs only sanitized context", async () => {
  const logged: unknown[] = [];
  const alert = await sendCampaignExceptionAlert(
    "unsafe provider failure! secret@example.com",
    checkedAt,
    exceptionAlertDependencies({
      sendMail: async () => {
        throw new Error("provider-secret-must-not-escape");
      },
      logMailFailure: (payload) => {
        logged.push(payload);
      },
    }),
  );

  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0], alert);
  assert.doesNotMatch(
    JSON.stringify(logged),
    /provider-secret-must-not-escape/,
  );
});

test("production exception alert deadline absorbs a never-settling provider", async () => {
  const logged: unknown[] = [];
  const startedAt = Date.now();
  const alert = await sendCampaignExceptionAlert(
    "database user@example.com timed out",
    checkedAt,
    exceptionAlertDependencies({
      sendMail: () => new Promise<never>(() => undefined),
      logMailFailure: (payload) => {
        logged.push(payload);
      },
      sendTimeoutMs: 5,
    }),
  );

  assert.ok(Date.now() - startedAt < 250);
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0], alert);
  assert.doesNotMatch(JSON.stringify(logged), /database|user|example/);
});
