import assert from "node:assert/strict";
import test from "node:test";
import { sendRefreshAlertIfNeeded } from "@/lib/inventory/refresh-alerting";

const healthyRun = {
  queued: 10,
  withdrawn: 0,
  processed: 10,
  completed: 10,
  retrying: 0,
  failed: 0,
  discarded: 0,
  recoveredLeases: 0,
  stoppedByDeadline: false,
  affectedProductSlugs: ["example-1", "example-2"],
};

const healthyBacklog = {
  active: 5,
  queued: 3,
  due: 5,
  processing: 0,
  leaseExpired: 0,
  oldestDueAt: new Date(),
};

test("does not alert when the cron run is healthy", async () => {
  const alert = await sendRefreshAlertIfNeeded(healthyRun, healthyBacklog);
  assert.equal(alert, undefined);
});

test("alerts when offers fail all retry attempts", async () => {
  const alert = await sendRefreshAlertIfNeeded(
    { ...healthyRun, failed: 5, completed: 5 },
    healthyBacklog,
  );
  assert.ok(alert);
  assert.equal(alert!.severity, "critical");
  assert.equal(alert!.event, "inventory_refresh_failed_offers");
  assert.ok(alert!.message.includes("5 offers failed"));
});

test("alerts when no offers were successfully refreshed", async () => {
  const alert = await sendRefreshAlertIfNeeded(
    { ...healthyRun, completed: 0, processed: 10, failed: 3, retrying: 7 },
    healthyBacklog,
  );
  assert.ok(alert);
  assert.equal(alert!.severity, "critical");
  assert.equal(alert!.event, "inventory_refresh_zero_completions");
});

test("alerts when the backlog grows beyond the threshold", async () => {
  const alert = await sendRefreshAlertIfNeeded(healthyRun, {
    ...healthyBacklog,
    due: 60,
  });
  assert.ok(alert);
  assert.equal(alert!.severity, "warning");
  assert.equal(alert!.event, "inventory_refresh_backlog_growing");
  assert.ok(alert!.message.includes("60 offers are due"));
});

test("does not alert when backlog is at the threshold boundary", async () => {
  const alert = await sendRefreshAlertIfNeeded(healthyRun, {
    ...healthyBacklog,
    due: 50,
  });
  assert.equal(alert, undefined);
});

test("alerts when stale offers accumulate beyond the threshold", async () => {
  const alert = await sendRefreshAlertIfNeeded(healthyRun, {
    ...healthyBacklog,
    staleOffers: 35,
  });
  assert.ok(alert);
  assert.equal(alert!.severity, "warning");
  assert.equal(alert!.event, "inventory_stale_offers_accumulating");
  assert.ok(alert!.message.includes("35 exact NG offers"));
});

test("does not alert when stale offers are at the threshold boundary", async () => {
  const alert = await sendRefreshAlertIfNeeded(healthyRun, {
    ...healthyBacklog,
    staleOffers: 30,
  });
  assert.equal(alert, undefined);
});
