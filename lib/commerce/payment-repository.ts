import "server-only";

import { getPostgresClient } from "@/lib/db/postgres";
import type { AssistedOrderState } from "./assisted-procurement-model";

export type PaymentProvider = "paystack" | "manual_bank_transfer";
export type PaymentStatus = "pending" | "verified" | "failed" | "abandoned";

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
  createdAt: string;
  updatedAt: string;
};

type PaymentRow = {
  id: string;
  order_id: string;
  quote_version: number;
  amount_ngn: number;
  provider: PaymentProvider;
  provider_reference: string | null;
  status: PaymentStatus;
  evidence_reference: string | null;
  verified_by_subject: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapPayment(row: PaymentRow): AssistedOrderPayment {
  return {
    id: row.id,
    orderId: row.order_id,
    quoteVersion: row.quote_version,
    amountNgn: row.amount_ngn,
    provider: row.provider,
    providerReference: row.provider_reference,
    status: row.status,
    evidenceReference: row.evidence_reference,
    verifiedBySubject: row.verified_by_subject,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createPayment(input: {
  orderId: string;
  quoteVersion: number;
  amountNgn: number;
  provider: PaymentProvider;
  providerReference: string | null;
}): Promise<AssistedOrderPayment> {
  const sql = getPostgresClient();
  const [row] = await sql<PaymentRow[]>`
    insert into assisted_order_payments (
      order_id, quote_version, amount_ngn, provider, provider_reference
    ) values (
      ${input.orderId}, ${input.quoteVersion}, ${input.amountNgn},
      ${input.provider}, ${input.providerReference}
    )
    returning id, order_id, quote_version, amount_ngn, provider,
              provider_reference, status, evidence_reference,
              verified_by_subject,
              case when verified_at is null then null else verified_at::text end as verified_at,
              created_at::text, updated_at::text
  `;
  return mapPayment(row);
}

export async function readPaymentByReference(
  providerReference: string,
): Promise<AssistedOrderPayment | null> {
  const sql = getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select id, order_id, quote_version, amount_ngn, provider,
           provider_reference, status, evidence_reference,
           verified_by_subject,
           case when verified_at is null then null else verified_at::text end as verified_at,
           created_at::text, updated_at::text
    from assisted_order_payments
    where provider_reference = ${providerReference}
    limit 1
  `;
  return rows.length ? mapPayment(rows[0]) : null;
}

export async function listPaymentsForOrder(
  orderId: string,
): Promise<AssistedOrderPayment[]> {
  const sql = getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select id, order_id, quote_version, amount_ngn, provider,
           provider_reference, status, evidence_reference,
           verified_by_subject,
           case when verified_at is null then null else verified_at::text end as verified_at,
           created_at::text, updated_at::text
    from assisted_order_payments
    where order_id = ${orderId}
    order by created_at desc
  `;
  return rows.map(mapPayment);
}

export async function readVerifiedPaymentForOrder(
  orderId: string,
): Promise<AssistedOrderPayment | null> {
  const sql = getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select id, order_id, quote_version, amount_ngn, provider,
           provider_reference, status, evidence_reference,
           verified_by_subject,
           case when verified_at is null then null else verified_at::text end as verified_at,
           created_at::text, updated_at::text
    from assisted_order_payments
    where order_id = ${orderId} and status = 'verified'
    limit 1
  `;
  return rows.length ? mapPayment(rows[0]) : null;
}

export async function readPendingPaystackPaymentForOrder(
  orderId: string,
): Promise<AssistedOrderPayment | null> {
  const sql = getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    select id, order_id, quote_version, amount_ngn, provider,
           provider_reference, status, evidence_reference,
           verified_by_subject,
           case when verified_at is null then null else verified_at::text end as verified_at,
           created_at::text, updated_at::text
    from assisted_order_payments
    where order_id = ${orderId}
      and provider = 'paystack'
      and status = 'pending'
    order by created_at desc
    limit 1
  `;
  return rows.length ? mapPayment(rows[0]) : null;
}

/**
 * Mark a payment as verified and transition the order to 'paid'.
 * This is the governed evidence boundary: only this function can move
 * an order from payment_pending to paid, and only when the payment
 * amount matches the approved quote total.
 * Returns the updated payment, or null if the payment was not found,
 * already verified, or the amount does not match the quote.
 */
export async function verifyPaymentAndMarkOrderPaid(input: {
  paymentId: string;
  evidenceReference: string;
  verifiedBySubject: string | null;
  expectedAmountNgn: number;
}): Promise<AssistedOrderPayment | null> {
  const sql = getPostgresClient();
  const result = await sql.begin(async (transaction) => {
    // Lock the payment row.
    const [payment] = await transaction<PaymentRow[]>`
      select id, order_id, quote_version, amount_ngn, provider,
             provider_reference, status, evidence_reference,
             verified_by_subject,
             case when verified_at is null then null else verified_at::text end as verified_at,
             created_at::text, updated_at::text
      from assisted_order_payments
      where id = ${input.paymentId}
      for update
    `;
    if (!payment) return null;
    if (payment.status === "verified") return mapPayment(payment);
    if (payment.status !== "pending") return null;

    // Verify amount matches.
    if (payment.amount_ngn !== input.expectedAmountNgn) return null;

    // Lock the order and verify it's in payment_pending state.
    const [order] = await transaction<
      { id: string; state: AssistedOrderState; revision: number }[]
    >`
      select id, state, revision from assisted_orders
      where id = ${payment.order_id}
      for update
    `;
    if (!order) return null;
    if (order.state !== "payment_pending") return null;

    // Mark payment as verified.
    await transaction`
      update assisted_order_payments set
        status = 'verified',
        evidence_reference = ${input.evidenceReference},
        verified_by_subject = ${input.verifiedBySubject},
        verified_at = now(),
        updated_at = now()
      where id = ${payment.id}
    `;

    // Transition order to paid.
    await transaction`
      update assisted_orders set
        state = 'paid', revision = revision + 1, updated_at = now()
      where id = ${order.id}
    `;

    // Record the event.
    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state,
        quote_version, reason
      ) values (
        ${order.id},
        ${input.verifiedBySubject ? "operator" : "system"},
        ${input.verifiedBySubject},
        'payment_verified',
        'payment_pending', 'paid',
        ${payment.quote_version},
        ${input.evidenceReference}
      )
    `;

    return mapPayment(payment);
  });
  return result;
}

/**
 * Mark a payment as failed or abandoned.
 */
export async function updatePaymentStatus(input: {
  paymentId: string;
  status: "failed" | "abandoned";
  evidenceReference: string | null;
}): Promise<AssistedOrderPayment | null> {
  const sql = getPostgresClient();
  const rows = await sql<PaymentRow[]>`
    update assisted_order_payments set
      status = ${input.status},
      evidence_reference = coalesce(${input.evidenceReference}, evidence_reference),
      updated_at = now()
    where id = ${input.paymentId} and status = 'pending'
    returning id, order_id, quote_version, amount_ngn, provider,
              provider_reference, status, evidence_reference,
              verified_by_subject,
              case when verified_at is null then null else verified_at::text end as verified_at,
              created_at::text, updated_at::text
  `;
  return rows.length ? mapPayment(rows[0]) : null;
}
