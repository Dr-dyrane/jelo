import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import type { AssistedOrderState } from "./assisted-procurement-model";
import {
  ngnToKobo,
  normalizeKoboAmount,
  normalizeNgnAmount,
} from "./payment-money";

export type PaymentProvider = "paystack" | "stripe" | "manual_bank_transfer";
export type PaymentStatus = "pending" | "verified" | "failed" | "abandoned";

export type ProviderInitialization = {
  phase: "reserved" | "ready";
  reservedAt: string;
  checkoutUrl: string | null;
  providerSessionId: string | null;
  initializedAt: string | null;
};

export type AssistedOrderPayment = {
  id: string;
  orderId: string;
  quoteVersion: number;
  amountNgn: number;
  provider: PaymentProvider;
  providerReference: string | null;
  status: PaymentStatus;
  evidenceReference: string | null;
  verifiedBySubject: string | null;
  verifiedAt: string | null;
  providerInitialization: ProviderInitialization | null;
  createdAt: string;
  updatedAt: string;
};

type PaymentRow = {
  id: string;
  order_id: string;
  quote_version: number;
  amount_ngn: string | number;
  provider: PaymentProvider;
  provider_reference: string | null;
  status: PaymentStatus;
  evidence_reference: string | null;
  verified_by_subject: string | null;
  verified_at: string | null;
  provider_metadata: unknown;
  created_at: string;
  updated_at: string;
};

type PaymentDatabase = ReturnType<typeof getPostgresClient>;

export class PaymentSettlementOutsideQuoteWindowError extends Error {
  constructor(
    readonly issuedAt: string,
    readonly expiresAt: string,
    readonly paidAt: string,
  ) {
    super("Provider settlement falls outside the approved quote window.");
    this.name = "PaymentSettlementOutsideQuoteWindowError";
  }
}

export class PaymentQuoteExpiredWithActiveAttemptError extends Error {
  constructor(
    readonly payment: AssistedOrderPayment,
    readonly expiresAt: string,
  ) {
    super(
      "The approved quote expired while its Stripe attempt remained active.",
    );
    this.name = "PaymentQuoteExpiredWithActiveAttemptError";
  }
}

export function isProviderSuccessWithinQuoteWindow(input: {
  issuedAt: string;
  expiresAt: string;
  successObservedAt: string;
}): boolean {
  const issuedAt = Date.parse(input.issuedAt);
  const expiresAt = Date.parse(input.expiresAt);
  const successObservedAt = Date.parse(input.successObservedAt);
  return (
    Number.isFinite(issuedAt) &&
    Number.isFinite(expiresAt) &&
    Number.isFinite(successObservedAt) &&
    successObservedAt >= issuedAt &&
    successObservedAt <= expiresAt
  );
}

const paymentColumns = `
  id, order_id, quote_version, amount_ngn, provider, provider_reference,
  status, evidence_reference, verified_by_subject,
  case when verified_at is null then null else verified_at::text end as verified_at,
  provider_metadata, created_at::text, updated_at::text
`;

function providerInitialization(value: unknown): ProviderInitialization | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (
    (metadata.phase !== "reserved" && metadata.phase !== "ready") ||
    typeof metadata.reservedAt !== "string"
  ) {
    return null;
  }
  return {
    phase: metadata.phase,
    reservedAt: metadata.reservedAt,
    checkoutUrl:
      typeof metadata.checkoutUrl === "string"
        ? metadata.checkoutUrl
        : typeof metadata.authorizationUrl === "string"
          ? metadata.authorizationUrl
          : null,
    providerSessionId:
      typeof metadata.providerSessionId === "string"
        ? metadata.providerSessionId
        : typeof metadata.accessCode === "string"
          ? metadata.accessCode
          : null,
    initializedAt:
      typeof metadata.initializedAt === "string"
        ? metadata.initializedAt
        : null,
  };
}

export function mapPaymentRow(row: PaymentRow): AssistedOrderPayment {
  return {
    id: row.id,
    orderId: row.order_id,
    quoteVersion: row.quote_version,
    amountNgn: normalizeNgnAmount(row.amount_ngn),
    provider: row.provider,
    providerReference: row.provider_reference,
    status: row.status,
    evidenceReference: row.evidence_reference,
    verifiedBySubject: row.verified_by_subject,
    verifiedAt: row.verified_at,
    providerInitialization: providerInitialization(row.provider_metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPayment(
  input: {
    orderId: string;
    quoteVersion: number;
    amountNgn: number;
    provider: PaymentProvider;
    providerReference: string | null;
  },
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment> {
  const sql = database ?? getPostgresClient();
  const amountNgn = normalizeNgnAmount(input.amountNgn);
  const [row] = await sql<PaymentRow[]>`
    insert into assisted_order_payments (
      order_id, quote_version, amount_ngn, provider, provider_reference
    ) values (
      ${input.orderId}, ${input.quoteVersion}, ${amountNgn},
      ${input.provider}, ${input.providerReference}
    )
    returning ${sql.unsafe(paymentColumns)}
  `;
  return mapPaymentRow(row);
}

export async function reserveStripePaymentAttempt(
  input: {
    orderId: string;
    quoteVersion: number;
    amountNgn: number;
    providerReference: string;
    reservedAt: string;
  },
  database?: PaymentDatabase,
): Promise<{ payment: AssistedOrderPayment; created: boolean }> {
  const sql = database ?? getPostgresClient();
  const amountNgn = normalizeNgnAmount(input.amountNgn);

  const outcome = await sql.begin(async (transaction) => {
    const [payable] = await transaction<
      {
        order_id: string;
        quote_version: number;
        total_ngn: string | number;
        expires_at: string;
      }[]
    >`
      select orders.id as order_id, quote.version as quote_version,
             quote.total_ngn, quote.expires_at::text
      from assisted_orders orders
      join assisted_order_quotes quote on quote.order_id = orders.id
      where orders.id = ${input.orderId}
        and orders.state = 'payment_pending'
        and quote.version = ${input.quoteVersion}
        and quote.status = 'approved'
        and quote.currency = 'NGN'
      for update of orders, quote
    `;
    if (!payable || ngnToKobo(payable.total_ngn) !== ngnToKobo(amountNgn)) {
      throw new Error("The approved order is no longer payable.");
    }

    if (Date.parse(payable.expires_at) <= Date.now()) {
      const [activeAttempt] = await transaction<PaymentRow[]>`
        select ${transaction.unsafe(paymentColumns)}
        from assisted_order_payments
        where order_id = ${payable.order_id}
          and quote_version = ${payable.quote_version}
          and provider = 'stripe'
          and status = 'pending'
        limit 1
        for update
      `;
      if (!activeAttempt) {
        await transaction`
          update assisted_order_quotes
          set status = 'expired', approved_at = null
          where order_id = ${payable.order_id}
            and version = ${payable.quote_version}
            and status = 'approved'
        `;
        await transaction`
          update assisted_orders
          set state = 'needs_response', revision = revision + 1, updated_at = now()
          where id = ${payable.order_id} and state = 'payment_pending'
        `;
        await transaction`
          insert into assisted_order_events (
            order_id, actor_kind, actor_reference, action, from_state, to_state,
            quote_version, reason, evidence_reference, metadata
          ) values (
            ${payable.order_id}, 'system', null, 'quote_expired',
            'payment_pending', 'needs_response', ${payable.quote_version},
            'Approved quote expired before payment began.', null, '{}'::jsonb
          )
        `;
      }
      return {
        kind: "expired" as const,
        activePayment: activeAttempt ? mapPaymentRow(activeAttempt) : null,
        expiresAt: payable.expires_at,
      };
    }

    const [created] = await transaction<PaymentRow[]>`
      insert into assisted_order_payments (
        order_id, quote_version, amount_ngn, provider, provider_reference,
        provider_metadata
      ) values (
        ${payable.order_id}, ${payable.quote_version}, ${amountNgn},
        'stripe', ${input.providerReference},
        ${transaction.json({ phase: "reserved", reservedAt: input.reservedAt })}
      )
      on conflict (order_id, quote_version)
        where provider = 'stripe' and status = 'pending'
      do nothing
      returning ${transaction.unsafe(paymentColumns)}
    `;

    if (created) {
      return {
        kind: "reserved" as const,
        value: { payment: mapPaymentRow(created), created: true },
      };
    }

    const [existing] = await transaction<PaymentRow[]>`
      select ${transaction.unsafe(paymentColumns)}
      from assisted_order_payments
      where order_id = ${input.orderId}
        and quote_version = ${input.quoteVersion}
        and provider = 'stripe'
        and status = 'pending'
      limit 1
      for update
    `;
    if (!existing) {
      throw new Error("The approved order is no longer payable.");
    }
    const payment = mapPaymentRow(existing);
    if (ngnToKobo(payment.amountNgn) !== ngnToKobo(amountNgn)) {
      throw new Error("The active payment does not match the approved quote.");
    }
    return {
      kind: "reserved" as const,
      value: { payment, created: false },
    };
  });

  if (outcome.kind === "expired") {
    if (outcome.activePayment) {
      throw new PaymentQuoteExpiredWithActiveAttemptError(
        outcome.activePayment,
        outcome.expiresAt,
      );
    }
    throw new Error("The approved quote expired. Request a fresh quote.");
  }
  return outcome.value;
}

export async function expireApprovedQuoteAfterPaymentClosed(
  input: {
    orderId: string;
    quoteVersion: number;
    paymentId: string;
  },
  database?: PaymentDatabase,
): Promise<boolean> {
  const sql = database ?? getPostgresClient();
  return sql.begin(async (transaction) => {
    const [order] = await transaction<{ state: AssistedOrderState }[]>`
      select state from assisted_orders where id = ${input.orderId} for update
    `;
    if (!order) return false;
    if (order.state === "needs_response") return true;
    if (order.state !== "payment_pending") return false;

    const [payment] = await transaction<{ status: PaymentStatus }[]>`
      select status from assisted_order_payments
      where id = ${input.paymentId} and order_id = ${input.orderId}
      for update
    `;
    if (!payment || payment.status === "pending") return false;

    const [quote] = await transaction<{ expires_at: string }[]>`
      select expires_at::text
      from assisted_order_quotes
      where order_id = ${input.orderId}
        and version = ${input.quoteVersion}
        and status = 'approved'
      for update
    `;
    if (!quote || Date.parse(quote.expires_at) > Date.now()) return false;

    await transaction`
      update assisted_order_quotes set status = 'expired', approved_at = null
      where order_id = ${input.orderId} and version = ${input.quoteVersion}
        and status = 'approved'
    `;
    await transaction`
      update assisted_orders
      set state = 'needs_response', revision = revision + 1, updated_at = now()
      where id = ${input.orderId} and state = 'payment_pending'
    `;
    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state,
        quote_version, reason, evidence_reference, metadata
      ) values (
        ${input.orderId}, 'system', null, 'quote_expired',
        'payment_pending', 'needs_response', ${input.quoteVersion},
        'Approved quote expired after its Stripe attempt closed.', null,
        ${transaction.json({ paymentId: input.paymentId, paymentStatus: payment.status })}
      )
    `;
    return true;
  });
}

export async function recordStripePaymentInitialization(
  input: {
    paymentId: string;
    providerReference: string;
    checkoutUrl: string;
    providerSessionId: string;
    initializedAt: string;
  },
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment | null> {
  const sql = database ?? getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    update assisted_order_payments
    set provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || ${sql.json(
      {
        phase: "ready",
        checkoutUrl: input.checkoutUrl,
        providerSessionId: input.providerSessionId,
        initializedAt: input.initializedAt,
      },
    )},
        updated_at = now()
    where id = ${input.paymentId}
      and provider = 'stripe'
      and provider_reference = ${input.providerReference}
      and status = 'pending'
    returning ${sql.unsafe(paymentColumns)}
  `;
  return rows.length ? mapPaymentRow(rows[0]) : null;
}

export async function readPaymentByReference(
  providerReference: string,
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment | null> {
  const sql = database ?? getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select ${sql.unsafe(paymentColumns)}
    from assisted_order_payments
    where provider_reference = ${providerReference}
      and provider in ('stripe', 'paystack')
    limit 1
  `;
  return rows.length ? mapPaymentRow(rows[0]) : null;
}

export async function listPaymentsForOrder(
  orderId: string,
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment[]> {
  const sql = database ?? getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select ${sql.unsafe(paymentColumns)}
    from assisted_order_payments
    where order_id = ${orderId}
    order by created_at desc
  `;
  return rows.map(mapPaymentRow);
}

export async function readVerifiedPaymentForOrder(
  orderId: string,
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment | null> {
  const sql = database ?? getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select ${sql.unsafe(paymentColumns)}
    from assisted_order_payments
    where order_id = ${orderId} and status = 'verified'
    limit 1
  `;
  return rows.length ? mapPaymentRow(rows[0]) : null;
}

export async function readPendingStripePaymentForOrder(
  orderId: string,
): Promise<AssistedOrderPayment | null> {
  const sql = getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select id, order_id, quote_version, amount_ngn, provider,
           provider_reference, status, evidence_reference,
           verified_by_subject,
           case when verified_at is null then null else verified_at::text end as verified_at,
           provider_metadata,
           created_at::text, updated_at::text
    from assisted_order_payments
    where order_id = ${orderId}
      and provider = 'stripe'
      and status = 'pending'
    order by created_at desc
    limit 1
  `;
  return rows.length ? mapPaymentRow(rows[0]) : null;
}

/**
 * This transaction is the automatic-payment evidence boundary. It compares
 * the received amount against both the reserved attempt and the locked,
 * approved quote. Callers cannot supply the quote total as authority.
 */
export async function verifyPaymentAndMarkOrderPaid(
  input: {
    paymentId: string;
    evidenceReference: string;
    evidenceMetadata: Record<string, unknown>;
    verifiedBySubject: string | null;
    receivedAmountKobo: number;
    paidAt: string;
  },
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment | null> {
  const sql = database ?? getPostgresClient();
  const receivedAmountKobo = normalizeKoboAmount(input.receivedAmountKobo);
  const paidAtMillis = Date.parse(input.paidAt);
  if (!Number.isFinite(paidAtMillis)) {
    throw new Error("Payment settlement time is invalid.");
  }

  return sql.begin(async (transaction) => {
    const [paymentIdentity] = await transaction<{ order_id: string }[]>`
      select order_id from assisted_order_payments where id = ${input.paymentId}
    `;
    if (!paymentIdentity) return null;

    const [order] = await transaction<
      { id: string; state: AssistedOrderState; revision: number }[]
    >`
      select id, state, revision
      from assisted_orders
      where id = ${paymentIdentity.order_id}
      for update
    `;
    if (!order) return null;

    const [paymentRow] = await transaction<PaymentRow[]>`
      select ${transaction.unsafe(paymentColumns)}
      from assisted_order_payments
      where id = ${input.paymentId}
      for update
    `;
    if (!paymentRow) return null;
    const payment = mapPaymentRow(paymentRow);
    if (payment.status === "verified") {
      return order.state === "paid" &&
        ngnToKobo(payment.amountNgn) === receivedAmountKobo
        ? payment
        : null;
    }
    if (order.state !== "payment_pending") return null;
    if (payment.status !== "pending") return null;
    if (payment.orderId !== order.id) return null;

    const [quote] = await transaction<
      {
        version: number;
        status: string;
        currency: string;
        total_ngn: string | number;
        issued_at: string;
        expires_at: string;
      }[]
    >`
      select version, status, currency, total_ngn,
             issued_at::text, expires_at::text
      from assisted_order_quotes
      where order_id = ${order.id} and version = ${payment.quoteVersion}
      for update
    `;
    if (!quote || quote.status !== "approved" || quote.currency !== "NGN") {
      return null;
    }
    if (
      !isProviderSuccessWithinQuoteWindow({
        issuedAt: quote.issued_at,
        expiresAt: quote.expires_at,
        successObservedAt: input.paidAt,
      })
    ) {
      throw new PaymentSettlementOutsideQuoteWindowError(
        quote.issued_at,
        quote.expires_at,
        input.paidAt,
      );
    }

    const quoteAmountKobo = ngnToKobo(quote.total_ngn);
    if (
      ngnToKobo(payment.amountNgn) !== receivedAmountKobo ||
      quoteAmountKobo !== receivedAmountKobo
    ) {
      return null;
    }

    const [updatedPayment] = await transaction<PaymentRow[]>`
      update assisted_order_payments
      set status = 'verified',
          evidence_reference = ${input.evidenceReference},
          verified_by_subject = ${input.verifiedBySubject},
          verified_at = now(),
          updated_at = now()
      where id = ${payment.id} and status = 'pending'
      returning ${transaction.unsafe(paymentColumns)}
    `;
    if (!updatedPayment) return null;

    const [updatedOrder] = await transaction<{ id: string }[]>`
      update assisted_orders
      set state = 'paid', revision = revision + 1, updated_at = now()
      where id = ${order.id} and state = 'payment_pending'
      returning id
    `;
    if (!updatedOrder) return null;

    await transaction`
      update assisted_order_payments
      set status = 'abandoned',
          evidence_reference = coalesce(
            evidence_reference,
            ${`superseded-by-verified-payment:${payment.id}`}
          ),
          updated_at = now()
      where order_id = ${order.id}
        and id <> ${payment.id}
        and status = 'pending'
    `;

    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state,
        quote_version, reason, evidence_reference, metadata
      ) values (
        ${order.id},
        ${input.verifiedBySubject ? "operator" : "system"},
        ${input.verifiedBySubject},
        'payment_verified', 'payment_pending', 'paid',
        ${payment.quoteVersion},
        'Governed payment evidence matched the approved quote.',
        ${input.evidenceReference},
        ${transaction.json({
          paymentId: payment.id,
          provider: payment.provider,
          providerReference: payment.providerReference,
          amountNgn: payment.amountNgn,
          currency: "NGN",
          ...input.evidenceMetadata,
        })}
      )
    `;

    return mapPaymentRow(updatedPayment);
  });
}

export async function createAndVerifyManualPayment(
  input: {
    orderId: string;
    receivedAmountNgn: number;
    providerReference: string;
    evidenceReference: string;
    operatorSubject: string;
  },
  database?: PaymentDatabase,
): Promise<
  | { ok: true; payment: AssistedOrderPayment }
  | {
      ok: false;
      reason:
        | "active_stripe"
        | "amount_mismatch"
        | "reference_reused"
        | "not_payable";
    }
> {
  const sql = database ?? getPostgresClient();
  const receivedAmountNgn = normalizeNgnAmount(input.receivedAmountNgn);
  const receivedAmountKobo = ngnToKobo(receivedAmountNgn);
  const evidenceReference = `manual:${input.evidenceReference.trim().toLowerCase()}`;
  const providerReference = input.providerReference
    .normalize("NFKC")
    .trim()
    .toUpperCase();
  if (!providerReference) {
    return { ok: false, reason: "not_payable" as const };
  }

  return sql.begin(async (transaction) => {
    const [order] = await transaction<
      { id: string; state: AssistedOrderState }[]
    >`
      select id, state from assisted_orders
      where id = ${input.orderId}
      for update
    `;
    if (!order || order.state !== "payment_pending") {
      return { ok: false, reason: "not_payable" as const };
    }

    const [activeStripe] = await transaction<{ id: string }[]>`
      select id from assisted_order_payments
      where order_id = ${order.id}
        and provider = 'stripe'
        and status = 'pending'
      limit 1
      for update
    `;
    if (activeStripe) {
      return { ok: false, reason: "active_stripe" as const };
    }

    const [quote] = await transaction<
      {
        version: number;
        currency: string;
        total_ngn: string | number;
        expires_at: string;
      }[]
    >`
      select version, currency, total_ngn, expires_at::text
      from assisted_order_quotes
      where order_id = ${order.id} and status = 'approved'
      order by version desc
      limit 1
      for update
    `;
    if (!quote || quote.currency !== "NGN") {
      return { ok: false, reason: "not_payable" as const };
    }
    if (Date.parse(quote.expires_at) <= Date.now()) {
      await transaction`
        update assisted_order_quotes
        set status = 'expired', approved_at = null
        where order_id = ${order.id} and version = ${quote.version}
          and status = 'approved'
      `;
      await transaction`
        update assisted_orders
        set state = 'needs_response', revision = revision + 1, updated_at = now()
        where id = ${order.id} and state = 'payment_pending'
      `;
      await transaction`
        insert into assisted_order_events (
          order_id, actor_kind, actor_reference, action, from_state, to_state,
          quote_version, reason, evidence_reference, metadata
        ) values (
          ${order.id}, 'system', null, 'quote_expired',
          'payment_pending', 'needs_response', ${quote.version},
          'Approved quote expired before payment was verified.', null, '{}'::jsonb
        )
      `;
      return { ok: false, reason: "not_payable" as const };
    }
    if (ngnToKobo(quote.total_ngn) !== receivedAmountKobo) {
      return { ok: false, reason: "amount_mismatch" as const };
    }

    const [payment] = await transaction<PaymentRow[]>`
      insert into assisted_order_payments (
        order_id, quote_version, amount_ngn, provider, provider_reference,
        status, evidence_reference, verified_by_subject, verified_at,
        provider_metadata
      ) values (
        ${order.id}, ${quote.version}, ${receivedAmountNgn},
        'manual_bank_transfer', ${providerReference}, 'verified',
        ${evidenceReference}, ${input.operatorSubject}, now(),
        ${transaction.json({
          receivedAmountNgn,
          currency: "NGN",
          recordedBy: input.operatorSubject,
        })}
      )
      on conflict do nothing
      returning ${transaction.unsafe(paymentColumns)}
    `;
    if (!payment) return { ok: false, reason: "reference_reused" as const };

    const [updatedOrder] = await transaction<{ id: string }[]>`
      update assisted_orders
      set state = 'paid', revision = revision + 1, updated_at = now()
      where id = ${order.id} and state = 'payment_pending'
      returning id
    `;
    if (!updatedOrder) return { ok: false, reason: "not_payable" as const };

    await transaction`
      update assisted_order_payments
      set status = 'abandoned',
          evidence_reference = coalesce(
            evidence_reference,
            ${`superseded-by-verified-payment:${payment.id}`}
          ),
          updated_at = now()
      where order_id = ${order.id}
        and id <> ${payment.id}
        and status = 'pending'
    `;

    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state,
        quote_version, reason, evidence_reference, metadata
      ) values (
        ${order.id}, 'operator', ${input.operatorSubject},
        'payment_verified', 'payment_pending', 'paid', ${quote.version},
        'An operator matched independently observed bank receipt evidence to the approved quote.',
        ${evidenceReference},
        ${transaction.json({
          paymentId: payment.id,
          provider: "manual_bank_transfer",
          providerReference,
          amountNgn: receivedAmountNgn,
          currency: "NGN",
        })}
      )
    `;

    return { ok: true, payment: mapPaymentRow(payment) };
  });
}

export async function updatePaymentStatus(
  input: {
    paymentId: string;
    status: "failed" | "abandoned";
    evidenceReference: string | null;
    reason?: string;
  },
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment | null> {
  const sql = database ?? getPostgresClient();

  return sql.begin(async (transaction) => {
    const [current] = await transaction<PaymentRow[]>`
      select ${transaction.unsafe(paymentColumns)}
      from assisted_order_payments
      where id = ${input.paymentId}
      for update
    `;
    if (!current) return null;
    if (current.status === input.status) return mapPaymentRow(current);
    if (current.status !== "pending") return null;

    const [updated] = await transaction<PaymentRow[]>`
      update assisted_order_payments
      set status = ${input.status},
          evidence_reference = coalesce(
            ${input.evidenceReference},
            evidence_reference
          ),
          updated_at = now()
      where id = ${input.paymentId} and status = 'pending'
      returning ${transaction.unsafe(paymentColumns)}
    `;
    if (!updated) return null;

    const [order] = await transaction<{ state: AssistedOrderState }[]>`
      select state from assisted_orders where id = ${updated.order_id}
    `;
    if (order?.state === "payment_pending") {
      await transaction`
        insert into assisted_order_events (
          order_id, actor_kind, actor_reference, action, from_state, to_state,
          quote_version, reason, evidence_reference, metadata
        ) values (
          ${updated.order_id}, 'system', null,
          ${input.status === "failed" ? "payment_failed" : "payment_abandoned"},
          'payment_pending', 'payment_pending', ${updated.quote_version},
          ${input.reason ?? `The ${updated.provider} payment was ${input.status}.`},
          ${input.evidenceReference},
          ${transaction.json({
            paymentId: updated.id,
            provider: updated.provider,
            providerReference: updated.provider_reference,
            status: input.status,
          })}
        )
      `;
    }

    return mapPaymentRow(updated);
  });
}

export async function recordPaymentReviewRequired(
  input: {
    paymentId: string;
    evidenceReference: string;
    reason: string;
    metadata: Record<string, unknown>;
  },
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment | null> {
  const sql = database ?? getPostgresClient();

  return sql.begin(async (transaction) => {
    const [identity] = await transaction<{ order_id: string }[]>`
      select order_id from assisted_order_payments where id = ${input.paymentId}
    `;
    if (!identity) return null;

    const [order] = await transaction<{ state: AssistedOrderState }[]>`
      select state from assisted_orders where id = ${identity.order_id} for update
    `;
    if (!order) return null;

    const [payment] = await transaction<PaymentRow[]>`
      select ${transaction.unsafe(paymentColumns)}
      from assisted_order_payments
      where id = ${input.paymentId}
      for update
    `;
    if (!payment) return null;

    const [sameReview] = await transaction<{ matches: boolean }[]>`
      select coalesce(
        provider_metadata->'reviewRequired'->>'evidenceReference' = ${input.evidenceReference},
        false
      ) as matches
      from assisted_order_payments
      where id = ${payment.id}
    `;
    if (sameReview?.matches) return mapPaymentRow(payment);

    const review = {
      evidenceReference: input.evidenceReference,
      reason: input.reason,
      recordedAt: new Date().toISOString(),
      ...input.metadata,
    };
    const [updated] = await transaction<PaymentRow[]>`
      update assisted_order_payments
      set provider_metadata = coalesce(provider_metadata, '{}'::jsonb) || ${transaction.json(
        {
          reviewRequired: review,
        },
      )},
          updated_at = now()
      where id = ${payment.id}
      returning ${transaction.unsafe(paymentColumns)}
    `;

    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state,
        quote_version, reason, evidence_reference, metadata
      ) values (
        ${payment.order_id}, 'system', null, 'payment_review_required',
        ${order.state}, ${order.state}, ${payment.quote_version},
        ${input.reason}, ${input.evidenceReference},
        ${transaction.json({
          paymentId: payment.id,
          provider: payment.provider,
          providerReference: payment.provider_reference,
          ...input.metadata,
        })}
      )
    `;

    await transaction`
      update assisted_orders set updated_at = now() where id = ${payment.order_id}
    `;

    return updated ? mapPaymentRow(updated) : null;
  });
}

/**
 * Read a bounded oldest-first batch for provider reconciliation. This query is
 * deliberately read-only: provider evidence must be observed before any stale
 * attempt can move to a terminal state.
 */
export async function listStalePendingStripePayments(
  input: { staleBefore: string; limit: number },
  database?: PaymentDatabase,
): Promise<AssistedOrderPayment[]> {
  const sql = database ?? getPostgresClient();
  const staleBefore = new Date(input.staleBefore);
  if (!Number.isFinite(staleBefore.getTime())) {
    throw new Error("Stripe reconciliation cutoff is invalid.");
  }
  const limit = Math.max(1, Math.min(25, Math.trunc(input.limit)));
  const rows = await sql<PaymentRow[]>`
    select ${sql.unsafe(paymentColumns)}
    from assisted_order_payments
    where status = 'pending'
      and provider = 'stripe'
      and created_at < ${staleBefore.toISOString()}::timestamptz
    order by created_at asc, id asc
    limit ${limit}
  `;
  return rows.map(mapPaymentRow);
}
