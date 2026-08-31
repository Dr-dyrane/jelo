import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { products } from "@/data/catalogue";
import {
  buildClinicalReviewPlan,
  CLINICAL_REVIEW_PLAN_SCHEMA_VERSION,
  isValidClinicalReviewDate,
} from "@/lib/clinical/clinical-review-plan";

test("clinical review plan covers every public product with a deterministic queue", () => {
  const first = buildClinicalReviewPlan(new Date("2026-08-31T06:30:00.000Z"));
  const second = buildClinicalReviewPlan(new Date("2026-08-31T07:30:00.000Z"));

  assert.equal(first.schemaVersion, CLINICAL_REVIEW_PLAN_SCHEMA_VERSION);
  assert.equal(first.status, "attention_required");
  assert.equal(first.writesPerformed, 0);
  assert.equal(first.counts.products, 163);
  assert.equal(first.counts.products, products.length);
  assert.deepEqual(first.counts.careStates, {
    supportiveEligible: 22,
    pharmacistReview: 39,
    insufficientData: 102,
    unreviewed: 0,
  });
  assert.equal(first.counts.current, 0);
  assert.equal(first.counts.queued, 163);
  assert.deepEqual(first.counts.reasons, {
    insufficient_evidence: 102,
    invalid_review_date: 0,
    legacy_attestation_requires_credential_binding: 39,
    missing_care_cell: 0,
    missing_source: 9,
    missing_verified_ingredients: 102,
    supportive_review_requires_credential_binding: 22,
    unattested_pharmacist_context: 0,
  });

  assert.equal(first.manifestDigest, second.manifestDigest);
  assert.deepEqual(
    first.queue.map((item) => item.idempotencyKey),
    second.queue.map((item) => item.idempotencyKey),
  );
  assert.equal(new Set(first.queue.map((item) => item.productSlug)).size, 163);
  assert.ok(
    first.queue.every(
      (item) =>
        /^[a-f0-9]{64}$/.test(item.idempotencyKey) &&
        /^[a-f0-9]{64}$/.test(item.productEvidenceDigest),
    ),
  );
});

test("review dates reject impossible and future chronology", () => {
  const generatedAt = new Date("2026-08-31T06:30:00.000Z");

  assert.equal(isValidClinicalReviewDate("2026-02-31", generatedAt), false);
  assert.equal(isValidClinicalReviewDate("2999-01-01", generatedAt), false);
  assert.equal(
    isValidClinicalReviewDate("2026-08-31T06:30:01Z", generatedAt),
    false,
  );
  assert.equal(isValidClinicalReviewDate("2026-08-31", generatedAt), true);
  assert.equal(
    isValidClinicalReviewDate("2026-08-31T06:30:00Z", generatedAt),
    true,
  );
  assert.equal(
    isValidClinicalReviewDate("2026-08-31T06:30:00.0Z", generatedAt),
    true,
  );
});

test("planner fails closed on duplicate catalogue identity", () => {
  assert.throws(
    () =>
      buildClinicalReviewPlan(new Date("2026-08-31T06:30:00.000Z"), [
        products[0],
        products[0],
      ]),
    /Duplicate public product slug/,
  );
});

test("scheduled clinical review route is authenticated, private and read-only", async () => {
  const [route, vercel] = await Promise.all([
    readFile("app/api/cron/clinical-review-health/route.ts", "utf8"),
    readFile("vercel.json", "utf8"),
  ]);
  const schedule = JSON.parse(vercel) as {
    crons: Array<{ path: string; schedule: string }>;
  };

  assert.match(route, /isAuthorizedCronRequest/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /buildClinicalReviewPlan/);
  assert.match(route, /clinical_review_health_checked/);
  assert.match(route, /clinical_review_health_failed/);
  assert.match(route, /private, no-store/);
  assert.match(route, /writesPerformed: plan\.writesPerformed/);
  assert.doesNotMatch(
    route,
    /postgres|database|insert|update|delete|revalidate|queue|fetch\(|sendMail/i,
  );
  assert.deepEqual(
    schedule.crons.filter(
      (entry) => entry.path === "/api/cron/clinical-review-health",
    ),
    [
      {
        path: "/api/cron/clinical-review-health",
        schedule: "53 5 * * *",
      },
    ],
  );
});
