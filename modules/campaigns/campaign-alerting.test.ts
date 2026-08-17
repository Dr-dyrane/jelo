import assert from "node:assert/strict";
import test from "node:test";
import {
  sendCampaignNoCandidateAlertIfNeeded,
  type NoCandidateAlertPayload,
} from "@/lib/campaigns/campaign-alerting";

const checkedAt = "2026-08-17T07:01:00.000Z";

test("no alert when zero candidates were rejected", async () => {
  const alert = await sendCampaignNoCandidateAlertIfNeeded(checkedAt, []);
  assert.equal(alert, undefined);
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
