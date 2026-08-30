import type { Sql } from "postgres";

export const BUSINESS_EVIDENCE_WINDOW_DAYS = 30;

const stageKeys = [
  "request",
  "quote",
  "approval",
  "payment",
  "retailerConfirmation",
  "dispatch",
  "delivery",
  "returnRequested",
  "refundInitiated",
  "refundCompleted",
  "closure",
] as const;

const conversionDefinitions = [
  ["requestToQuote", "request", "quote"],
  ["quoteToApproval", "quote", "approval"],
  ["approvalToPayment", "approval", "payment"],
  ["paymentToRetailerConfirmation", "payment", "retailerConfirmation"],
  ["retailerConfirmationToDispatch", "retailerConfirmation", "dispatch"],
  ["dispatchToDelivery", "dispatch", "delivery"],
  ["deliveryToReturn", "delivery", "returnRequested"],
  ["returnToRefundInitiation", "returnRequested", "refundInitiated"],
  ["refundInitiationToCompletion", "refundInitiated", "refundCompleted"],
  ["requestToClosure", "request", "closure"],
] as const;

const slaKeys = conversionDefinitions.map(([key]) => key);

export const BUSINESS_EVIDENCE_COST_COMPLETENESS = {
  settledProductAmount: "available",
  settledServiceFee: "available",
  settledDeliveryAmount: "available",
  settledTotalAmount: "available",
  stripeFees: "unavailable",
  operatorLabour: "unavailable",
  messagingAiCost: "unavailable",
  retailerVariance: "unavailable",
  customerAcquisitionCost: "unavailable",
  chargebackRefundLoss: "unavailable",
  contributionMargin: "unavailable",
  repeatOrderCohortProof: "unavailable",
} as const;

type StageKey = (typeof stageKeys)[number];
type SlaKey = (typeof slaKeys)[number];

type EvidenceMetric = {
  required: number;
  complete: number;
  missing: number;
  completionPct: number | null;
};

type RawSlaMetric = {
  eligible?: unknown;
  measured?: unknown;
  missing?: unknown;
  invalid?: unknown;
  p50Seconds?: unknown;
  p95Seconds?: unknown;
};

type SlaMetric = {
  eligible: number;
  measured: number;
  missing: number;
  invalid: number;
  p50Seconds: number | null;
  p95Seconds: number | null;
};

type AggregateRow = {
  stages: Record<string, unknown> | null;
  conversions: Record<
    string,
    {
      eligible?: unknown;
      converted?: unknown;
    }
  > | null;
  slas: Record<string, RawSlaMetric> | null;
  settled_amounts: {
    verifiedPayments?: unknown;
    completeQuoteBreakdowns?: unknown;
    missingQuoteBreakdowns?: unknown;
    completePaymentEvidence?: unknown;
    missingPaymentEvidence?: unknown;
    fullyProvenSettlements?: unknown;
    incompleteSettlements?: unknown;
    productNgn?: unknown;
    serviceFeeNgn?: unknown;
    deliveryNgn?: unknown;
    totalNgn?: unknown;
  } | null;
  evidence_completeness: Record<
    string,
    {
      required?: unknown;
      complete?: unknown;
    }
  > | null;
};

function nonNegativeInteger(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error("Business evidence aggregate returned an invalid count.");
  }
  return number;
}

function optionalNonNegativeNumber(value: unknown) {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(
      "Business evidence aggregate returned an invalid duration.",
    );
  }
  return number;
}

function optionalMoney(value: unknown) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^\d+\.\d{2}$/.test(value)) {
    throw new Error("Business evidence aggregate returned an invalid amount.");
  }
  return value;
}

function percentage(numerator: number, denominator: number) {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function normalizeEvidenceMetric(
  raw:
    | {
        required?: unknown;
        complete?: unknown;
      }
    | undefined,
): EvidenceMetric {
  const required = nonNegativeInteger(raw?.required ?? 0);
  const complete = nonNegativeInteger(raw?.complete ?? 0);
  if (complete > required) {
    throw new Error("Business evidence completeness exceeds its population.");
  }
  return {
    required,
    complete,
    missing: required - complete,
    completionPct: percentage(complete, required),
  };
}

function normalizeSlaMetric(raw: RawSlaMetric | undefined): SlaMetric {
  const eligible = nonNegativeInteger(raw?.eligible ?? 0);
  const measured = nonNegativeInteger(raw?.measured ?? 0);
  const missing = nonNegativeInteger(raw?.missing ?? 0);
  const invalid = nonNegativeInteger(raw?.invalid ?? 0);
  const p50Seconds = optionalNonNegativeNumber(raw?.p50Seconds);
  const p95Seconds = optionalNonNegativeNumber(raw?.p95Seconds);
  if (measured + missing + invalid !== eligible) {
    throw new Error("Business evidence SLA populations do not balance.");
  }
  if (
    (measured === 0 && (p50Seconds !== null || p95Seconds !== null)) ||
    (measured > 0 &&
      (p50Seconds === null || p95Seconds === null || p95Seconds < p50Seconds))
  ) {
    throw new Error("Business evidence SLA percentiles are inconsistent.");
  }
  return {
    eligible,
    measured,
    missing,
    invalid,
    p50Seconds,
    p95Seconds,
  };
}

/**
 * Reads one fixed 30-day request cohort and returns aggregate evidence only.
 * The statement has no dynamic identifiers and contains SELECT CTEs only.
 */
export async function readBusinessEvidenceRegister(sql: Sql, asOf: Date) {
  if (!Number.isFinite(asOf.getTime())) {
    throw new Error("Business evidence cutoff is invalid.");
  }
  const windowEnd = asOf.toISOString();
  const windowStart = new Date(
    asOf.getTime() - BUSINESS_EVIDENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [row] = await sql<AggregateRow[]>`
    with window_orders as (
      select id, state, created_at
      from assisted_orders
      where created_at >= ${windowStart}::timestamptz
        and created_at < ${windowEnd}::timestamptz
    ), latest_return as (
      select distinct on (events.order_id)
        events.order_id, events.action, events.created_at
      from assisted_order_events events
      join window_orders orders on orders.id = events.order_id
      where events.created_at < ${windowEnd}::timestamptz
        and events.action in ('return_requested', 'return_declined', 'refund_pending')
      order by events.order_id, events.sequence_id desc
    ), event_milestones as (
      select
        orders.id,
        orders.state,
        orders.created_at as request_at,
        min(events.created_at) filter (where events.action = 'quote_issued') as quote_at,
        min(events.created_at) filter (where events.action = 'quote_approved') as approval_at,
        min(
          case when events.action = 'payment_verified' then
            case
              when nullif(events.metadata->>'observedPaidAt', '') is not null
                and pg_input_is_valid(
                  events.metadata->>'observedPaidAt',
                  'timestamp with time zone'
                )
              then (events.metadata->>'observedPaidAt')::timestamptz
              else events.created_at
            end
          end
        ) as payment_at,
        min(events.created_at) filter (where events.action = 'retailer_confirmed') as retailer_confirmation_at,
        min(events.created_at) filter (where events.action = 'out_for_delivery') as dispatch_at,
        min(events.created_at) filter (where events.action = 'delivered') as delivery_at,
        min(events.created_at) filter (where events.action = 'return_requested') as return_at,
        min(events.created_at) filter (where events.action = 'refund_pending') as refund_initiated_at,
        min(events.created_at) filter (where events.action = 'refunded') as refund_completed_at,
        min(events.created_at) filter (where events.action = 'order_cancelled') as cancelled_at
      from window_orders orders
      left join assisted_order_events events
        on events.order_id = orders.id
        and events.created_at < ${windowEnd}::timestamptz
      group by orders.id, orders.state, orders.created_at
    ), milestones as (
      select
        event_milestones.*,
        case
          when event_milestones.state = 'cancelled' then event_milestones.cancelled_at
          when event_milestones.state = 'refunded' then event_milestones.refund_completed_at
          when event_milestones.state = 'delivered'
            and latest_return.action = 'return_requested' then null
          when event_milestones.state = 'delivered'
            and latest_return.action = 'return_declined' then latest_return.created_at
          when event_milestones.state = 'delivered' then event_milestones.delivery_at
          else null
        end as closure_at
      from event_milestones
      left join latest_return on latest_return.order_id = event_milestones.id
    ), stage_counts as (
      select jsonb_build_object(
        'request', count(*)::int,
        'quote', count(*) filter (where quote_at is not null)::int,
        'approval', count(*) filter (where approval_at is not null)::int,
        'payment', count(*) filter (where payment_at is not null)::int,
        'retailerConfirmation', count(*) filter (where retailer_confirmation_at is not null)::int,
        'dispatch', count(*) filter (where dispatch_at is not null)::int,
        'delivery', count(*) filter (where delivery_at is not null)::int,
        'returnRequested', count(*) filter (where return_at is not null)::int,
        'refundInitiated', count(*) filter (where refund_initiated_at is not null)::int,
        'refundCompleted', count(*) filter (where refund_completed_at is not null)::int,
        'closure', count(*) filter (where closure_at is not null)::int
      ) as value
      from milestones
    ), conversion_counts as (
      select jsonb_build_object(
        'requestToQuote', jsonb_build_object(
          'eligible', count(*)::int,
          'converted', count(*) filter (where quote_at is not null)::int
        ),
        'quoteToApproval', jsonb_build_object(
          'eligible', count(*) filter (where quote_at is not null)::int,
          'converted', count(*) filter (
            where quote_at is not null and approval_at is not null
          )::int
        ),
        'approvalToPayment', jsonb_build_object(
          'eligible', count(*) filter (where approval_at is not null)::int,
          'converted', count(*) filter (
            where approval_at is not null and payment_at is not null
          )::int
        ),
        'paymentToRetailerConfirmation', jsonb_build_object(
          'eligible', count(*) filter (where payment_at is not null)::int,
          'converted', count(*) filter (
            where payment_at is not null and retailer_confirmation_at is not null
          )::int
        ),
        'retailerConfirmationToDispatch', jsonb_build_object(
          'eligible', count(*) filter (where retailer_confirmation_at is not null)::int,
          'converted', count(*) filter (
            where retailer_confirmation_at is not null and dispatch_at is not null
          )::int
        ),
        'dispatchToDelivery', jsonb_build_object(
          'eligible', count(*) filter (where dispatch_at is not null)::int,
          'converted', count(*) filter (
            where dispatch_at is not null and delivery_at is not null
          )::int
        ),
        'deliveryToReturn', jsonb_build_object(
          'eligible', count(*) filter (where delivery_at is not null)::int,
          'converted', count(*) filter (
            where delivery_at is not null and return_at is not null
          )::int
        ),
        'returnToRefundInitiation', jsonb_build_object(
          'eligible', count(*) filter (where return_at is not null)::int,
          'converted', count(*) filter (
            where return_at is not null and refund_initiated_at is not null
          )::int
        ),
        'refundInitiationToCompletion', jsonb_build_object(
          'eligible', count(*) filter (where refund_initiated_at is not null)::int,
          'converted', count(*) filter (
            where refund_initiated_at is not null and refund_completed_at is not null
          )::int
        ),
        'requestToClosure', jsonb_build_object(
          'eligible', count(*)::int,
          'converted', count(*) filter (where closure_at is not null)::int
        )
      ) as value
      from milestones
    ), sla_pairs as (
      select pairs.metric, pairs.started_at, pairs.finished_at
      from milestones
      cross join lateral (values
        ('requestToQuote', request_at, quote_at),
        ('quoteToApproval', quote_at, approval_at),
        ('approvalToPayment', approval_at, payment_at),
        ('paymentToRetailerConfirmation', payment_at, retailer_confirmation_at),
        ('retailerConfirmationToDispatch', retailer_confirmation_at, dispatch_at),
        ('dispatchToDelivery', dispatch_at, delivery_at),
        ('deliveryToReturn', delivery_at, return_at),
        ('returnToRefundInitiation', return_at, refund_initiated_at),
        ('refundInitiationToCompletion', refund_initiated_at, refund_completed_at),
        ('requestToClosure', request_at, closure_at)
      ) as pairs(metric, started_at, finished_at)
    ), sla_summary as (
      select
        metric,
        count(*) filter (where started_at is not null)::int as eligible,
        count(*) filter (
          where started_at is not null and finished_at >= started_at
        )::int as measured,
        count(*) filter (
          where started_at is not null and finished_at is null
        )::int as missing,
        count(*) filter (
          where started_at is not null and finished_at < started_at
        )::int as invalid,
        round((percentile_cont(0.5) within group (
          order by extract(epoch from (finished_at - started_at))
        ) filter (
          where started_at is not null and finished_at >= started_at
        ))::numeric, 3)::double precision as "p50Seconds",
        round((percentile_cont(0.95) within group (
          order by extract(epoch from (finished_at - started_at))
        ) filter (
          where started_at is not null and finished_at >= started_at
        ))::numeric, 3)::double precision as "p95Seconds"
      from sla_pairs
      group by metric
    ), sla_json as (
      select coalesce(
        jsonb_object_agg(
          metric,
          jsonb_build_object(
            'eligible', eligible,
            'measured', measured,
            'missing', missing,
            'invalid', invalid,
            'p50Seconds', "p50Seconds",
            'p95Seconds', "p95Seconds"
          )
        ),
        '{}'::jsonb
      ) as value
      from sla_summary
    ), terminal_payments as (
      select
        payments.id,
        payments.order_id,
        payments.quote_version,
        payments.amount_ngn,
        payments.provider,
        payments.provider_reference,
        payments.status,
        payments.evidence_reference,
        payments.verified_at,
        quotes.id as quote_id,
        quotes.product_subtotal_ngn,
        quotes.jelocare_fee_ngn,
        quotes.delivery_ngn,
        quotes.total_ngn,
        (
          quotes.id is not null
          and quotes.product_subtotal_ngn is not null
          and quotes.jelocare_fee_ngn is not null
          and quotes.delivery_ngn is not null
          and quotes.total_ngn is not null
          and quotes.total_ngn = payments.amount_ngn
        ) as has_complete_breakdown,
        exists (
          select 1
          from assisted_order_events events
          where events.order_id = payments.order_id
            and events.created_at < ${windowEnd}::timestamptz
            and events.quote_version = payments.quote_version
            and events.action = case payments.status
              when 'verified' then 'payment_verified'
              when 'failed' then 'payment_failed'
              when 'abandoned' then 'payment_abandoned'
            end
            and events.metadata->>'paymentId' = payments.id::text
            and events.evidence_reference is not distinct from payments.evidence_reference
            and events.metadata->>'provider' = payments.provider
            and events.metadata->>'providerReference'
              is not distinct from payments.provider_reference
            and (
              (
                payments.status = 'verified'
                and events.from_state = 'payment_pending'
                and events.to_state = 'paid'
                and payments.verified_at is not null
                and nullif(btrim(payments.evidence_reference), '') is not null
                and nullif(btrim(payments.provider_reference), '') is not null
                and events.metadata->>'currency' = 'NGN'
                and case
                  when pg_input_is_valid(events.metadata->>'amountNgn', 'numeric')
                  then (events.metadata->>'amountNgn')::numeric = payments.amount_ngn
                  else false
                end
                and (
                  payments.provider <> 'stripe'
                  or (
                    nullif(events.metadata->>'observedPaidAt', '') is not null
                    and pg_input_is_valid(
                      events.metadata->>'observedPaidAt',
                      'timestamp with time zone'
                    )
                  )
                )
              )
              or (
                payments.status in ('failed', 'abandoned')
                and events.from_state = 'payment_pending'
                and events.to_state = 'payment_pending'
                and events.metadata->>'status' = payments.status
              )
            )
        ) as has_matching_event
      from assisted_order_payments payments
      join window_orders orders on orders.id = payments.order_id
      left join assisted_order_quotes quotes
        on quotes.order_id = payments.order_id
        and quotes.version = payments.quote_version
      where payments.status in ('verified', 'failed', 'abandoned')
        and payments.updated_at < ${windowEnd}::timestamptz
    ), settled_amounts as (
      select jsonb_build_object(
        'verifiedPayments', count(*) filter (where status = 'verified')::int,
        'completeQuoteBreakdowns', count(*) filter (
          where status = 'verified'
            and has_complete_breakdown
        )::int,
        'missingQuoteBreakdowns', count(*) filter (
          where status = 'verified'
            and not has_complete_breakdown
        )::int,
        'completePaymentEvidence', count(*) filter (
          where status = 'verified'
            and has_matching_event
        )::int,
        'missingPaymentEvidence', count(*) filter (
          where status = 'verified'
            and not has_matching_event
        )::int,
        'fullyProvenSettlements', count(*) filter (
          where status = 'verified'
            and has_complete_breakdown
            and has_matching_event
        )::int,
        'incompleteSettlements', count(*) filter (
          where status = 'verified'
            and not (has_complete_breakdown and has_matching_event)
        )::int,
        'productNgn', case
          when count(*) filter (where status = 'verified') = 0 then null
          when bool_and(
            has_complete_breakdown and has_matching_event
          ) filter (where status = 'verified')
          then to_char(sum(product_subtotal_ngn) filter (where status = 'verified'), 'FM999999999999990.00')
          else null
        end,
        'serviceFeeNgn', case
          when count(*) filter (where status = 'verified') = 0 then null
          when bool_and(
            has_complete_breakdown and has_matching_event
          ) filter (where status = 'verified')
          then to_char(sum(jelocare_fee_ngn) filter (where status = 'verified'), 'FM999999999999990.00')
          else null
        end,
        'deliveryNgn', case
          when count(*) filter (where status = 'verified') = 0 then null
          when bool_and(
            has_complete_breakdown and has_matching_event
          ) filter (where status = 'verified')
          then to_char(sum(delivery_ngn) filter (where status = 'verified'), 'FM999999999999990.00')
          else null
        end,
        'totalNgn', case
          when count(*) filter (where status = 'verified') = 0 then null
          when bool_and(
            has_complete_breakdown and has_matching_event
          ) filter (where status = 'verified')
          then to_char(sum(amount_ngn) filter (where status = 'verified'), 'FM999999999999990.00')
          else null
        end
      ) as value
      from terminal_payments
    ), review_evidence as (
      select
        count(*)::int as required,
        count(*) filter (
          where nullif(btrim(events.evidence_reference), '') is not null
            and nullif(btrim(events.reason), '') is not null
            and events.quote_version is not null
            and nullif(events.metadata->>'paymentId', '') is not null
            and nullif(events.metadata->>'provider', '') is not null
        )::int as complete
      from assisted_order_events events
      join window_orders orders on orders.id = events.order_id
      where events.action = 'payment_review_required'
        and events.created_at < ${windowEnd}::timestamptz
    ), refund_evidence as (
      select
        count(*)::int as initiation_required,
        count(*) filter (
          where refunds.payment_id is not null
            and nullif(btrim(refunds.initiated_evidence_reference), '') is not null
            and refunds.initiated_at is not null
        )::int as initiation_complete,
        count(*) filter (where refunds.status = 'refunded')::int as completion_required,
        count(*) filter (
          where refunds.status = 'refunded'
            and nullif(btrim(refunds.completion_reference), '') is not null
            and nullif(btrim(refunds.completion_evidence_reference), '') is not null
            and refunds.completed_at is not null
        )::int as completion_complete
      from assisted_order_refunds refunds
      join window_orders orders on orders.id = refunds.order_id
      where refunds.initiated_at < ${windowEnd}::timestamptz
    ), payment_evidence as (
      select
        count(terminal_payments.id)::int as terminal_required,
        count(terminal_payments.id) filter (
          where terminal_payments.has_matching_event
        )::int as terminal_complete,
        count(terminal_payments.id) filter (
          where terminal_payments.status = 'verified'
        )::int as settlement_required,
        count(terminal_payments.id) filter (
          where terminal_payments.status = 'verified'
            and terminal_payments.has_matching_event
        )::int as settlement_complete
      from terminal_payments
    ), evidence_completeness as (
      select jsonb_build_object(
        'terminalPayment', jsonb_build_object(
          'required', payment_evidence.terminal_required,
          'complete', payment_evidence.terminal_complete
        ),
        'settledPayment', jsonb_build_object(
          'required', payment_evidence.settlement_required,
          'complete', payment_evidence.settlement_complete
        ),
        'paymentReview', jsonb_build_object(
          'required', review_evidence.required,
          'complete', review_evidence.complete
        ),
        'refundInitiation', jsonb_build_object(
          'required', refund_evidence.initiation_required,
          'complete', refund_evidence.initiation_complete
        ),
        'refundCompletion', jsonb_build_object(
          'required', refund_evidence.completion_required,
          'complete', refund_evidence.completion_complete
        )
      ) as value
      from payment_evidence
      cross join review_evidence
      cross join refund_evidence
    )
    select
      stage_counts.value as stages,
      conversion_counts.value as conversions,
      sla_json.value as slas,
      settled_amounts.value as settled_amounts,
      evidence_completeness.value as evidence_completeness
    from stage_counts
    cross join conversion_counts
    cross join sla_json
    cross join settled_amounts
    cross join evidence_completeness
  `;

  if (!row) {
    throw new Error("Business evidence aggregate returned no row.");
  }

  const stages = Object.fromEntries(
    stageKeys.map((key) => [key, nonNegativeInteger(row.stages?.[key] ?? 0)]),
  ) as Record<StageKey, number>;
  const conversions = Object.fromEntries(
    conversionDefinitions.map(([key]) => {
      const raw = row.conversions?.[key];
      const eligible = nonNegativeInteger(raw?.eligible ?? 0);
      const converted = nonNegativeInteger(raw?.converted ?? 0);
      if (converted > eligible) {
        throw new Error(
          "Business evidence conversion exceeds its eligible population.",
        );
      }
      return [
        key,
        {
          eligible,
          converted,
          ratePct: percentage(converted, eligible),
        },
      ];
    }),
  );
  const slas = Object.fromEntries(
    slaKeys.map((key) => [key, normalizeSlaMetric(row.slas?.[key])]),
  ) as Record<SlaKey, SlaMetric>;

  const verifiedPayments = nonNegativeInteger(
    row.settled_amounts?.verifiedPayments ?? 0,
  );
  const completeQuoteBreakdowns = nonNegativeInteger(
    row.settled_amounts?.completeQuoteBreakdowns ?? 0,
  );
  const missingQuoteBreakdowns = nonNegativeInteger(
    row.settled_amounts?.missingQuoteBreakdowns ?? 0,
  );
  const completePaymentEvidence = nonNegativeInteger(
    row.settled_amounts?.completePaymentEvidence ?? 0,
  );
  const missingPaymentEvidence = nonNegativeInteger(
    row.settled_amounts?.missingPaymentEvidence ?? 0,
  );
  const fullyProvenSettlements = nonNegativeInteger(
    row.settled_amounts?.fullyProvenSettlements ?? 0,
  );
  const incompleteSettlements = nonNegativeInteger(
    row.settled_amounts?.incompleteSettlements ?? 0,
  );
  if (
    completeQuoteBreakdowns + missingQuoteBreakdowns !== verifiedPayments ||
    completePaymentEvidence + missingPaymentEvidence !== verifiedPayments ||
    fullyProvenSettlements + incompleteSettlements !== verifiedPayments ||
    fullyProvenSettlements > completeQuoteBreakdowns ||
    fullyProvenSettlements > completePaymentEvidence
  ) {
    throw new Error("Business evidence settlement populations do not balance.");
  }
  const settledValues = {
    productNgn: optionalMoney(row.settled_amounts?.productNgn),
    serviceFeeNgn: optionalMoney(row.settled_amounts?.serviceFeeNgn),
    deliveryNgn: optionalMoney(row.settled_amounts?.deliveryNgn),
    totalNgn: optionalMoney(row.settled_amounts?.totalNgn),
  };
  const amountValues = Object.values(settledValues);
  if (
    ((verifiedPayments === 0 || incompleteSettlements > 0) &&
      amountValues.some((amount) => amount !== null)) ||
    (verifiedPayments > 0 &&
      incompleteSettlements === 0 &&
      amountValues.some((amount) => amount === null))
  ) {
    throw new Error("Business evidence settlement amounts are inconsistent.");
  }

  return {
    schemaVersion: 1,
    generatedAt: windowEnd,
    window: {
      basis: "order_requested_at",
      days: BUSINESS_EVIDENCE_WINDOW_DAYS,
      start: windowStart,
      end: windowEnd,
    },
    writesPerformed: 0,
    stages,
    conversions,
    slas,
    settledAmounts: {
      currency: "NGN",
      verifiedPayments,
      completeQuoteBreakdowns,
      missingQuoteBreakdowns,
      completePaymentEvidence,
      missingPaymentEvidence,
      fullyProvenSettlements,
      incompleteSettlements,
      ...settledValues,
    },
    evidenceCompleteness: {
      terminalPayment: normalizeEvidenceMetric(
        row.evidence_completeness?.terminalPayment,
      ),
      settledPayment: normalizeEvidenceMetric(
        row.evidence_completeness?.settledPayment,
      ),
      paymentReview: normalizeEvidenceMetric(
        row.evidence_completeness?.paymentReview,
      ),
      refundInitiation: normalizeEvidenceMetric(
        row.evidence_completeness?.refundInitiation,
      ),
      refundCompletion: normalizeEvidenceMetric(
        row.evidence_completeness?.refundCompletion,
      ),
    },
    costCompleteness: BUSINESS_EVIDENCE_COST_COMPLETENESS,
  } as const;
}
