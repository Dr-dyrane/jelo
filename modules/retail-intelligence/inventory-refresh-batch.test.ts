import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeInventoryRefreshClaimBatch,
  type InventoryRefreshResult,
} from "@/lib/inventory/refresh-worker";

function completedResult(id: string): InventoryRefreshResult {
  return {
    jobId: `job-${id}`,
    offerId: `offer-${id}`,
    productSlug: `product-${id}`,
    status: "completed",
    recoveredLease: false,
  };
}

test("a mixed concurrent claim batch retains every defined settlement before stopping", () => {
  const first = completedResult("first");
  const third = completedResult("third");

  const summary = summarizeInventoryRefreshClaimBatch(
    [first, undefined, third],
    true,
  );

  assert.deepEqual(summary.results, [first, third]);
  assert.equal(summary.shouldStop, true);
  assert.equal(summary.stoppedByDeadline, false);
});

test("a deadline stops the next claim batch without discarding settled results", () => {
  const first = completedResult("first");
  const second = completedResult("second");

  const summary = summarizeInventoryRefreshClaimBatch([first, second], false);

  assert.deepEqual(summary.results, [first, second]);
  assert.equal(summary.shouldStop, true);
  assert.equal(summary.stoppedByDeadline, true);
});
