import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import {
  createAndVerifyManualPayment,
  expireApprovedQuoteAfterPaymentClosed,
  recordPaymentReviewRequired,
  recordPaystackPaymentInitialization,
  reservePaystackPaymentAttempt,
  updatePaymentStatus,
  verifyPaymentAndMarkOrderPaid,
} from "../../lib/commerce/payment-repository";

const databaseUrl = process.env.PAYMENT_INTEGRITY_TEST_DATABASE_URL;

test(
  "repository enforces one active attempt and atomically verifies exact money",
  {
    skip: databaseUrl
      ? false
      : "requires an explicitly writable disposable PAYMENT_INTEGRITY_TEST_DATABASE_URL",
  },
  async () => {
    const admin = postgres(databaseUrl!, { max: 1, prepare: false });
    const schema = `payment_integrity_${randomUUID().replaceAll("-", "")}`;
    await admin.unsafe(`create schema "${schema}"`);
    const sql = postgres(databaseUrl!, { max: 1, prepare: false });
    const concurrentSql = postgres(databaseUrl!, { max: 1, prepare: false });

    try {
      await sql.unsafe(`set search_path to "${schema}"`);
      await concurrentSql.unsafe(`set search_path to "${schema}"`);
      await sql.unsafe(`
        create table assisted_orders (
          id uuid primary key,
          state text not null,
          revision integer not null default 1,
          updated_at timestamptz not null default now()
        );
        create table assisted_order_quotes (
          order_id uuid not null references assisted_orders(id),
          version integer not null,
          status text not null,
          currency text not null,
          total_ngn numeric(12,2) not null,
          issued_at timestamptz not null default (now() - interval '1 hour'),
          expires_at timestamptz not null default (now() + interval '1 day'),
          approved_at timestamptz default now(),
          primary key (order_id, version)
        );
        create table assisted_order_payments (
          id uuid primary key default gen_random_uuid(),
          order_id uuid not null references assisted_orders(id),
          quote_version integer not null,
          amount_ngn numeric(12,2) not null,
          provider text not null,
          provider_reference text,
          status text not null default 'pending',
          evidence_reference text,
          verified_by_subject text,
          verified_at timestamptz,
          provider_metadata jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create unique index one_verified_payment
          on assisted_order_payments (order_id) where status = 'verified';
        create unique index one_active_paystack_quote
          on assisted_order_payments (order_id, quote_version)
          where provider = 'paystack' and status = 'pending';
        create unique index one_paystack_reference
          on assisted_order_payments (provider_reference)
          where provider = 'paystack' and provider_reference is not null;
        create unique index one_manual_reference
          on assisted_order_payments (lower(btrim(provider_reference)))
          where provider = 'manual_bank_transfer' and status = 'verified';
        create table assisted_order_events (
          id uuid not null unique default gen_random_uuid(),
          order_id uuid not null references assisted_orders(id),
          actor_kind text not null,
          actor_reference text,
          action text not null,
          from_state text,
          to_state text not null,
          quote_version integer,
          reason text,
          evidence_reference text,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        );
      `);

      const orderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state) values (${orderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn
        ) values (${orderId}, 1, 'approved', 'NGN', 123.45)
      `;

      const [first, replay] = await Promise.all([
        reservePaystackPaymentAttempt(
          {
            orderId,
            quoteVersion: 1,
            amountNgn: 123.45,
            providerReference: "JC-ONE-Q1-FIRST",
            reservedAt: "2026-08-14T10:00:00.000Z",
          },
          concurrentSql,
        ),
        reservePaystackPaymentAttempt(
          {
            orderId,
            quoteVersion: 1,
            amountNgn: 123.45,
            providerReference: "JC-ONE-Q1-REPLAY",
            reservedAt: "2026-08-14T10:00:00.000Z",
          },
          sql,
        ),
      ]);
      assert.equal([first.created, replay.created].filter(Boolean).length, 1);
      assert.equal(first.payment.id, replay.payment.id);
      assert.equal(
        first.payment.providerReference,
        replay.payment.providerReference,
      );

      const initialized = await recordPaystackPaymentInitialization(
        {
          paymentId: first.payment.id,
          providerReference: first.payment.providerReference!,
          authorizationUrl: "https://checkout.paystack.com/access",
          accessCode: "access",
          initializedAt: "2026-08-14T10:00:01.000Z",
        },
        sql,
      );
      assert.equal(initialized?.paystackInitialization?.phase, "ready");

      const verified = await verifyPaymentAndMarkOrderPaid(
        {
          paymentId: first.payment.id,
          evidenceReference: "paystack:JC-ONE:2026-08-14T10:01:00.000Z",
          evidenceMetadata: {
            currency: "NGN",
            paidAt: "2026-08-14T10:01:00.000Z",
          },
          verifiedBySubject: null,
          receivedAmountKobo: 12_345,
          paidAt: new Date().toISOString(),
        },
        sql,
      );
      assert.equal(verified?.status, "verified");
      assert.ok(verified?.verifiedAt);

      const duplicate = await verifyPaymentAndMarkOrderPaid(
        {
          paymentId: first.payment.id,
          evidenceReference: "paystack:duplicate",
          evidenceMetadata: {},
          verifiedBySubject: null,
          receivedAmountKobo: 12_345,
          paidAt: new Date().toISOString(),
        },
        sql,
      );
      assert.equal(duplicate?.status, "verified");

      const [paidOrder] = await sql<{ state: string }[]>`
        select state from assisted_orders where id = ${orderId}
      `;
      const [eventCount] = await sql<{ count: number }[]>`
        select count(*)::int as count from assisted_order_events
        where order_id = ${orderId} and action = 'payment_verified'
      `;
      assert.equal(paidOrder.state, "paid");
      assert.equal(eventCount.count, 1);

      const autoMismatchOrderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state)
        values (${autoMismatchOrderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn
        ) values (${autoMismatchOrderId}, 1, 'approved', 'NGN', 500.00)
      `;
      const autoMismatchAttempt = await reservePaystackPaymentAttempt(
        {
          orderId: autoMismatchOrderId,
          quoteVersion: 1,
          amountNgn: 500,
          providerReference: "JC-AUTO-MISMATCH",
          reservedAt: "2026-08-14T11:00:00.000Z",
        },
        sql,
      );
      const autoMismatch = await verifyPaymentAndMarkOrderPaid(
        {
          paymentId: autoMismatchAttempt.payment.id,
          evidenceReference: "paystack:wrong-kobo",
          evidenceMetadata: {},
          verifiedBySubject: null,
          receivedAmountKobo: 49_999,
          paidAt: new Date().toISOString(),
        },
        sql,
      );
      assert.equal(autoMismatch, null);
      const [untouchedAutoOrder] = await sql<{ state: string }[]>`
        select state from assisted_orders where id = ${autoMismatchOrderId}
      `;
      const [untouchedAutoPayment] = await sql<{ status: string }[]>`
        select status from assisted_order_payments
        where id = ${autoMismatchAttempt.payment.id}
      `;
      assert.equal(untouchedAutoOrder.state, "payment_pending");
      assert.equal(untouchedAutoPayment.status, "pending");
      const mixedChannel = await createAndVerifyManualPayment(
        {
          orderId: autoMismatchOrderId,
          receivedAmountNgn: 500,
          providerReference: "BANK-WHILE-PAYSTACK-LIVE",
          evidenceReference: "bank-statement-live-conflict",
          operatorSubject: "operator:test",
        },
        sql,
      );
      assert.deepEqual(mixedChannel, { ok: false, reason: "active_paystack" });
      const reviewInput = {
        paymentId: autoMismatchAttempt.payment.id,
        evidenceReference: "paystack-review:JC-AUTO-MISMATCH:amount-mismatch",
        reason: "Paystack reported a successful charge for a different amount.",
        metadata: { expectedAmountKobo: 50_000, observedAmountKobo: 49_999 },
      };
      await recordPaymentReviewRequired(reviewInput, sql);
      await recordPaymentReviewRequired(reviewInput, sql);
      const [reviewCount] = await sql<{ count: number }[]>`
        select count(*)::int as count from assisted_order_events
        where order_id = ${autoMismatchOrderId}
          and action = 'payment_review_required'
      `;
      assert.equal(reviewCount.count, 1);

      const mismatchOrderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state)
        values (${mismatchOrderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn
        ) values (${mismatchOrderId}, 1, 'approved', 'NGN', 500.00)
      `;
      const mismatch = await createAndVerifyManualPayment(
        {
          orderId: mismatchOrderId,
          receivedAmountNgn: 499.99,
          providerReference: "BANK-MISMATCH",
          evidenceReference: "bank-statement-mismatch",
          operatorSubject: "operator:test",
        },
        sql,
      );
      assert.deepEqual(mismatch, { ok: false, reason: "amount_mismatch" });
      const [mismatchPayments] = await sql<{ count: number }[]>`
        select count(*)::int as count from assisted_order_payments
        where order_id = ${mismatchOrderId}
      `;
      assert.equal(mismatchPayments.count, 0);

      const manual = await createAndVerifyManualPayment(
        {
          orderId: mismatchOrderId,
          receivedAmountNgn: 500,
          providerReference: "BANK-EXACT",
          evidenceReference: "bank-statement-exact",
          operatorSubject: "operator:test",
        },
        sql,
      );
      assert.equal(manual.ok, true);
      if (manual.ok) {
        assert.equal(manual.payment.status, "verified");
        assert.equal(manual.payment.amountNgn, 500);
      }

      const replayOrderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state)
        values (${replayOrderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn
        ) values (${replayOrderId}, 1, 'approved', 'NGN', 500.00)
      `;
      const replayedBankEvidence = await createAndVerifyManualPayment(
        {
          orderId: replayOrderId,
          receivedAmountNgn: 500,
          providerReference: "  bank-exact  ",
          evidenceReference: "different operator note",
          operatorSubject: "operator:test",
        },
        sql,
      );
      assert.deepEqual(replayedBankEvidence, {
        ok: false,
        reason: "reference_reused",
      });

      const lateOrderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state)
        values (${lateOrderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn, issued_at, expires_at
        ) values (
          ${lateOrderId}, 1, 'approved', 'NGN', 700.00,
          now() - interval '1 hour', now() + interval '1 hour'
        )
      `;
      const lateAttempt = await reservePaystackPaymentAttempt(
        {
          orderId: lateOrderId,
          quoteVersion: 1,
          amountNgn: 700,
          providerReference: "JC-LATE",
          reservedAt: new Date().toISOString(),
        },
        sql,
      );
      await assert.rejects(
        verifyPaymentAndMarkOrderPaid(
          {
            paymentId: lateAttempt.payment.id,
            evidenceReference: "paystack:late",
            evidenceMetadata: {},
            verifiedBySubject: null,
            receivedAmountKobo: 70_000,
            paidAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          },
          sql,
        ),
        /outside the approved quote window/i,
      );
      const [lateState] = await sql<{ state: string; status: string }[]>`
        select orders.state, payment.status
        from assisted_orders orders
        join assisted_order_payments payment on payment.order_id = orders.id
        where orders.id = ${lateOrderId}
      `;
      assert.deepEqual(lateState, {
        state: "payment_pending",
        status: "pending",
      });

      const expiredOrderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state)
        values (${expiredOrderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn, issued_at, expires_at
        ) values (
          ${expiredOrderId}, 1, 'approved', 'NGN', 800.00,
          now() - interval '2 days', now() - interval '1 day'
        )
      `;
      await assert.rejects(
        reservePaystackPaymentAttempt(
          {
            orderId: expiredOrderId,
            quoteVersion: 1,
            amountNgn: 800,
            providerReference: "JC-EXPIRED",
            reservedAt: new Date().toISOString(),
          },
          sql,
        ),
        /quote expired/i,
      );
      const [expired] = await sql<
        { state: string; quote_status: string; event_count: number }[]
      >`
        select orders.state, quote.status as quote_status,
               count(event.id)::int as event_count
        from assisted_orders orders
        join assisted_order_quotes quote on quote.order_id = orders.id
        left join assisted_order_events event
          on event.order_id = orders.id and event.action = 'quote_expired'
        where orders.id = ${expiredOrderId}
        group by orders.state, quote.status
      `;
      assert.deepEqual(expired, {
        state: "needs_response",
        quote_status: "expired",
        event_count: 1,
      });

      const expiredActiveOrderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state)
        values (${expiredActiveOrderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn,
          issued_at, expires_at
        ) values (
          ${expiredActiveOrderId}, 1, 'approved', 'NGN', 850.00,
          now() - interval '1 hour', now() + interval '1 hour'
        )
      `;
      const expiredActiveAttempt = await reservePaystackPaymentAttempt(
        {
          orderId: expiredActiveOrderId,
          quoteVersion: 1,
          amountNgn: 850,
          providerReference: "JC-EXPIRED-ACTIVE",
          reservedAt: new Date().toISOString(),
        },
        sql,
      );
      await sql`
        update assisted_order_quotes set expires_at = now() - interval '1 minute'
        where order_id = ${expiredActiveOrderId} and version = 1
      `;
      const closedExpiredAttempt = await updatePaymentStatus(
        {
          paymentId: expiredActiveAttempt.payment.id,
          status: "abandoned",
          evidenceReference: "paystack:expired-active:not-found",
        },
        sql,
      );
      assert.equal(closedExpiredAttempt?.status, "abandoned");
      assert.equal(
        await expireApprovedQuoteAfterPaymentClosed(
          {
            orderId: expiredActiveOrderId,
            quoteVersion: 1,
            paymentId: expiredActiveAttempt.payment.id,
          },
          sql,
        ),
        true,
      );
      const [expiredActiveState] = await sql<
        { state: string; quote_status: string }[]
      >`
        select orders.state, quote.status as quote_status
        from assisted_orders orders
        join assisted_order_quotes quote on quote.order_id = orders.id
        where orders.id = ${expiredActiveOrderId}
      `;
      assert.deepEqual(expiredActiveState, {
        state: "needs_response",
        quote_status: "expired",
      });

      const raceOrderId = randomUUID();
      await sql`
        insert into assisted_orders (id, state)
        values (${raceOrderId}, 'payment_pending')
      `;
      await sql`
        insert into assisted_order_quotes (
          order_id, version, status, currency, total_ngn
        ) values (${raceOrderId}, 1, 'approved', 'NGN', 900.00)
      `;
      const [reservationRace, manualRace] = await Promise.allSettled([
        reservePaystackPaymentAttempt(
          {
            orderId: raceOrderId,
            quoteVersion: 1,
            amountNgn: 900,
            providerReference: "JC-CHANNEL-RACE",
            reservedAt: new Date().toISOString(),
          },
          sql,
        ),
        createAndVerifyManualPayment(
          {
            orderId: raceOrderId,
            receivedAmountNgn: 900,
            providerReference: "BANK-CHANNEL-RACE",
            evidenceReference: "bank-channel-race-evidence",
            operatorSubject: "operator:test",
          },
          concurrentSql,
        ),
      ]);
      assert.equal(manualRace.status, "fulfilled");
      const [raceInvariant] = await sql<
        { state: string; pending_paystack: number; verified: number }[]
      >`
        select orders.state,
               count(payment.id) filter (
                 where payment.provider = 'paystack' and payment.status = 'pending'
               )::int as pending_paystack,
               count(payment.id) filter (where payment.status = 'verified')::int as verified
        from assisted_orders orders
        left join assisted_order_payments payment on payment.order_id = orders.id
        where orders.id = ${raceOrderId}
        group by orders.state
      `;
      if (raceInvariant.state === "paid") {
        assert.equal(reservationRace.status, "rejected");
        assert.equal(raceInvariant.pending_paystack, 0);
        assert.equal(raceInvariant.verified, 1);
      } else {
        assert.equal(reservationRace.status, "fulfilled");
        assert.equal(raceInvariant.state, "payment_pending");
        assert.equal(raceInvariant.pending_paystack, 1);
        assert.equal(raceInvariant.verified, 0);
        assert.deepEqual(
          manualRace.status === "fulfilled" ? manualRace.value : null,
          { ok: false, reason: "active_paystack" },
        );
      }
    } finally {
      await concurrentSql.end();
      await sql.end();
      await admin.unsafe(`drop schema "${schema}" cascade`);
      await admin.end();
    }
  },
);
