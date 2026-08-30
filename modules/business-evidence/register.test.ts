import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Sql } from "postgres";
import {
  BUSINESS_EVIDENCE_COST_COMPLETENESS,
  BUSINESS_EVIDENCE_WINDOW_DAYS,
  readBusinessEvidenceRegister,
} from "../../lib/business-evidence/register";

const aggregateRow = {
  stages: {
    request: 10,
    quote: 8,
    approval: 6,
    payment: 5,
    retailerConfirmation: 4,
    dispatch: 3,
    delivery: 2,
    returnRequested: 1,
    refundInitiated: 1,
    refundCompleted: 1,
    closure: 3,
  },
  conversions: {
    requestToQuote: { eligible: 10, converted: 8 },
    quoteToApproval: { eligible: 8, converted: 6 },
    approvalToPayment: { eligible: 6, converted: 5 },
    paymentToRetailerConfirmation: { eligible: 5, converted: 4 },
    retailerConfirmationToDispatch: { eligible: 4, converted: 3 },
    dispatchToDelivery: { eligible: 3, converted: 2 },
    deliveryToReturn: { eligible: 2, converted: 1 },
    returnToRefundInitiation: { eligible: 1, converted: 1 },
    refundInitiationToCompletion: { eligible: 1, converted: 1 },
    requestToClosure: { eligible: 10, converted: 3 },
  },
  slas: {
    requestToQuote: {
      eligible: 10,
      measured: 8,
      missing: 2,
      invalid: 0,
      p50Seconds: 90,
      p95Seconds: 180,
    },
  },
  settled_amounts: {
    verifiedPayments: 5,
    completeQuoteBreakdowns: 5,
    missingQuoteBreakdowns: 0,
    completePaymentEvidence: 5,
    missingPaymentEvidence: 0,
    fullyProvenSettlements: 5,
    incompleteSettlements: 0,
    productNgn: "50000.00",
    serviceFeeNgn: "2500.00",
    deliveryNgn: "5000.00",
    totalNgn: "57500.00",
  },
  evidence_completeness: {
    terminalPayment: { required: 6, complete: 5 },
    settledPayment: { required: 5, complete: 5 },
    paymentReview: { required: 2, complete: 1 },
    refundInitiation: { required: 1, complete: 1 },
    refundCompletion: { required: 1, complete: 1 },
  },
};

function queryReturning(
  row: Record<string, unknown> | null,
  capture: { text?: string; values?: unknown[] },
) {
  return (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    capture.text = strings.join("?");
    capture.values = values;
    return row ? [row] : [];
  }) as unknown as Sql;
}

test("builds only the bounded aggregate contract and marks unavailable costs", async () => {
  const capture: { text?: string; values?: unknown[] } = {};
  const asOf = new Date("2026-08-30T22:00:00.000Z");
  const report = await readBusinessEvidenceRegister(
    queryReturning(aggregateRow, capture),
    asOf,
  );

  assert.equal(report.window.days, BUSINESS_EVIDENCE_WINDOW_DAYS);
  assert.equal(report.window.start, "2026-07-31T22:00:00.000Z");
  assert.equal(report.window.end, asOf.toISOString());
  assert.equal(report.writesPerformed, 0);
  assert.deepEqual(report.conversions.requestToQuote, {
    eligible: 10,
    converted: 8,
    ratePct: 80,
  });
  assert.deepEqual(report.conversions.deliveryToReturn, {
    eligible: 2,
    converted: 1,
    ratePct: 50,
  });
  assert.deepEqual(report.evidenceCompleteness.terminalPayment, {
    required: 6,
    complete: 5,
    missing: 1,
    completionPct: 83.33,
  });
  assert.equal(report.slas.requestToQuote.p95Seconds, 180);
  assert.equal(report.settledAmounts.fullyProvenSettlements, 5);
  assert.equal(report.settledAmounts.totalNgn, "57500.00");
  assert.deepEqual(report.slas.quoteToApproval, {
    eligible: 0,
    measured: 0,
    missing: 0,
    invalid: 0,
    p50Seconds: null,
    p95Seconds: null,
  });
  assert.deepEqual(
    report.costCompleteness,
    BUSINESS_EVIDENCE_COST_COMPLETENESS,
  );
  assert.equal(report.costCompleteness.stripeFees, "unavailable");
  assert.equal(report.costCompleteness.contributionMargin, "unavailable");
  assert.deepEqual(capture.values, [
    "2026-07-31T22:00:00.000Z",
    "2026-08-30T22:00:00.000Z",
    "2026-08-30T22:00:00.000Z",
    "2026-08-30T22:00:00.000Z",
    "2026-08-30T22:00:00.000Z",
    "2026-08-30T22:00:00.000Z",
    "2026-08-30T22:00:00.000Z",
    "2026-08-30T22:00:00.000Z",
  ]);
});

test("the aggregate query contains SELECTs only and no row-level output columns", async () => {
  const capture: { text?: string; values?: unknown[] } = {};
  await readBusinessEvidenceRegister(
    queryReturning(aggregateRow, capture),
    new Date("2026-08-30T22:00:00.000Z"),
  );

  assert.match(capture.text ?? "", /^\s*with\s/i);
  assert.doesNotMatch(
    capture.text ?? "",
    /\b(insert|update|delete|merge|truncate|alter|create|drop|grant|revoke|call)\b/i,
  );
  assert.doesNotMatch(
    JSON.stringify(
      await readBusinessEvidenceRegister(
        queryReturning(aggregateRow, {}),
        new Date("2026-08-30T22:00:00.000Z"),
      ),
    ),
    /contactName|contactEmail|ownerSubject|publicReference|providerReference|productSlug|productName|concern|queryText|reason/i,
  );
  assert.match(
    capture.text ?? "",
    /events\.evidence_reference is not distinct from payments\.evidence_reference/,
  );
  assert.match(
    capture.text ?? "",
    /events\.metadata->>'provider' = payments\.provider/,
  );
  assert.match(
    capture.text ?? "",
    /events\.metadata->>'providerReference'[\s\S]*is not distinct from payments\.provider_reference/,
  );
  assert.match(
    capture.text ?? "",
    /\(events\.metadata->>'amountNgn'\)::numeric = payments\.amount_ngn/,
  );
  assert.match(capture.text ?? "", /events\.metadata->>'currency' = 'NGN'/);
  assert.match(capture.text ?? "", /events\.from_state = 'payment_pending'/);
  assert.match(capture.text ?? "", /events\.to_state = 'paid'/);
  assert.match(
    capture.text ?? "",
    /bool_and\(\s*has_complete_breakdown and has_matching_event\s*\)/,
  );
});

test("a governed payment metadata mismatch suppresses every settled amount", async () => {
  const report = await readBusinessEvidenceRegister(
    queryReturning(
      {
        ...aggregateRow,
        settled_amounts: {
          verifiedPayments: 5,
          completeQuoteBreakdowns: 5,
          missingQuoteBreakdowns: 0,
          completePaymentEvidence: 4,
          missingPaymentEvidence: 1,
          fullyProvenSettlements: 4,
          incompleteSettlements: 1,
          productNgn: null,
          serviceFeeNgn: null,
          deliveryNgn: null,
          totalNgn: null,
        },
        evidence_completeness: {
          ...aggregateRow.evidence_completeness,
          terminalPayment: { required: 6, complete: 4 },
          settledPayment: { required: 5, complete: 4 },
        },
      },
      {},
    ),
    new Date("2026-08-30T22:00:00.000Z"),
  );

  assert.equal(report.settledAmounts.missingQuoteBreakdowns, 0);
  assert.equal(report.settledAmounts.missingPaymentEvidence, 1);
  assert.equal(report.settledAmounts.incompleteSettlements, 1);
  assert.deepEqual(report.evidenceCompleteness.settledPayment, {
    required: 5,
    complete: 4,
    missing: 1,
    completionPct: 80,
  });
  assert.equal(report.settledAmounts.productNgn, null);
  assert.equal(report.settledAmounts.serviceFeeNgn, null);
  assert.equal(report.settledAmounts.deliveryNgn, null);
  assert.equal(report.settledAmounts.totalNgn, null);
});

test("fails closed when the aggregate is absent or internally inconsistent", async () => {
  await assert.rejects(
    readBusinessEvidenceRegister(
      queryReturning(null, {}),
      new Date("2026-08-30T22:00:00.000Z"),
    ),
    /returned no row/,
  );
  await assert.rejects(
    readBusinessEvidenceRegister(
      queryReturning(
        {
          ...aggregateRow,
          settled_amounts: {
            ...aggregateRow.settled_amounts,
            missingQuoteBreakdowns: 1,
          },
        },
        {},
      ),
      new Date("2026-08-30T22:00:00.000Z"),
    ),
    /do not balance/,
  );
  await assert.rejects(
    readBusinessEvidenceRegister(
      queryReturning(
        {
          ...aggregateRow,
          slas: {
            requestToQuote: {
              eligible: 10,
              measured: 8,
              missing: 1,
              invalid: 0,
              p50Seconds: 90,
              p95Seconds: 180,
            },
          },
        },
        {},
      ),
      new Date("2026-08-30T22:00:00.000Z"),
    ),
    /SLA populations do not balance/,
  );
});

test("cron route is secret-protected, no-store, read-only, and visibly fails", async () => {
  const [route, schedule] = await Promise.all([
    readFile("app/api/cron/business-evidence/route.ts", "utf8"),
    readFile("vercel.json", "utf8"),
  ]);
  assert.match(route, /isAuthorizedCronRequest/);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /getPostgresClient\(\)/);
  assert.match(route, /readBusinessEvidenceRegister/);
  assert.match(route, /business_evidence_register_checked/);
  assert.match(route, /business_evidence_register_failed/);
  assert.match(route, /private, no-store/);
  assert.doesNotMatch(
    route,
    /reconcile|transition|deliverPending|sendMail|fetch\(|revalidate|redis|queue|payment-service|stripe-provider/i,
  );
  assert.deepEqual(
    JSON.parse(schedule).crons.find(
      (entry: { path: string }) => entry.path === "/api/cron/business-evidence",
    ),
    { path: "/api/cron/business-evidence", schedule: "23 5 * * *" },
  );
});
