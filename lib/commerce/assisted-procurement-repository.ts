import "server-only";

import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { getPostgresClient } from "@/lib/db/postgres";
import {
  assistedOrderFixtureEnabled,
  assistedOrderCookieMaxAge,
  assistedOrderRecoveryMaxAge,
} from "./assisted-procurement-security";
import type {
  AssistedOrderEventView,
  AssistedOrderLineView,
  AssistedOrderQuoteComponents,
  AssistedOrderQuoteView,
  AssistedOrderState,
  AssistedOrderView,
} from "./assisted-procurement-model";
import {
  deliverPendingAssistedOrderNotifications,
  recordOrderNotificationDevelopmentFixture,
  resetOrderNotificationDevelopmentFixture,
  setOrderNotificationPreferenceDevelopmentFixture,
} from "./order-notification-repository";

export type AssistedOrderPrivateView = AssistedOrderView & {
  contactPhone: string;
  deliveryAddress: string;
  deliveryInstructions: string | null;
};

export type CreateAssistedOrderRecord = {
  requestKeyHash: string;
  requestFingerprint: string;
  reference: string;
  ownerSubject: string | null;
  retailer: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryInstructions: string | null;
  whatsappConsent: boolean;
  emailNotificationsConsent: boolean;
  sessionHash: string;
  recoveryHash: string;
  lines: Array<
    AssistedOrderLineView & {
      observedListingUrl: string;
      observedEvidenceReference: string;
      observedAt: string;
    }
  >;
};

type OrderRow = {
  id: string;
  public_reference: string;
  owner_subject: string | null;
  retailer_name: string;
  state: AssistedOrderState;
  revision: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_instructions: string | null;
  whatsapp_consent: boolean;
  email_notifications_consent: boolean;
  created_at: string;
  updated_at: string;
};

function fixtureStore() {
  const scope = globalThis as typeof globalThis & {
    __jelocareAssistedOrders?: {
      orders: Map<string, AssistedOrderPrivateView>;
      sessions: Map<string, string>;
      recoveries: Map<
        string,
        { orderId: string; expiresAt: number; consumed: boolean }
      >;
      requests: Map<string, { orderId: string; fingerprint: string }>;
    };
  };
  scope.__jelocareAssistedOrders ??= {
    orders: new Map(),
    sessions: new Map(),
    recoveries: new Map(),
    requests: new Map(),
  };
  return scope.__jelocareAssistedOrders;
}

export function resetAssistedProcurementDevelopmentFixture() {
  if (!assistedOrderFixtureEnabled())
    throw new Error("Development fixture is not enabled.");
  const store = fixtureStore();
  store.orders.clear();
  store.sessions.clear();
  store.recoveries.clear();
  store.requests.clear();
  resetOrderNotificationDevelopmentFixture();
}

async function hydrateOrder(
  sql: Sql,
  row: OrderRow,
): Promise<AssistedOrderPrivateView> {
  const [lineRows, quoteRows, eventRows] = await Promise.all([
    sql<
      {
        product_slug: string;
        product_brand: string;
        product_name: string;
        product_size: string;
        product_image: string;
        quantity: number;
        observed_unit_price_ngn: number;
        observed_listing_url: string;
      }[]
    >`
      select product_slug, product_brand, product_name, product_size, product_image,
             quantity, observed_unit_price_ngn, observed_listing_url
      from assisted_order_lines where order_id = ${row.id}
      order by created_at, id
    `,
    sql<
      {
        id: string;
        version: number;
        status: AssistedOrderQuoteView["status"];
        product_subtotal_ngn: number | null;
        retailer_fee_ngn: number | null;
        tax_ngn: number | null;
        jelocare_fee_ngn: number | null;
        delivery_ngn: number | null;
        total_ngn: number | null;
        evidence_reference: string;
        notes: string | null;
        issued_at: string;
        expires_at: string;
        approved_at: string | null;
      }[]
    >`
      select id, version, status, product_subtotal_ngn, retailer_fee_ngn, tax_ngn,
             jelocare_fee_ngn, delivery_ngn, total_ngn, evidence_reference, notes,
             issued_at::text, expires_at::text,
             case when approved_at is null then null else approved_at::text end as approved_at
      from assisted_order_quotes where order_id = ${row.id}
      order by version desc limit 1
    `,
    sql<
      {
        id: string;
        action: string;
        from_state: AssistedOrderState | null;
        to_state: AssistedOrderState;
        reason: string | null;
        created_at: string;
      }[]
    >`
      select id, action, from_state, to_state, reason, created_at::text
      from assisted_order_events where order_id = ${row.id}
      order by sequence_id
    `,
  ]);

  const quoteRow = quoteRows[0];
  const quote: AssistedOrderQuoteView | null = quoteRow
    ? {
        id: quoteRow.id,
        version: quoteRow.version,
        status: quoteRow.status,
        components: {
          productSubtotalNgn: quoteRow.product_subtotal_ngn,
          retailerFeeNgn: quoteRow.retailer_fee_ngn,
          taxNgn: quoteRow.tax_ngn,
          jelocareFeeNgn: quoteRow.jelocare_fee_ngn,
          deliveryNgn: quoteRow.delivery_ngn,
        },
        totalNgn: quoteRow.total_ngn,
        evidenceReference: quoteRow.evidence_reference,
        notes: quoteRow.notes,
        issuedAt: quoteRow.issued_at,
        expiresAt: quoteRow.expires_at,
        approvedAt: quoteRow.approved_at,
      }
    : null;

  return {
    id: row.id,
    reference: row.public_reference,
    retailer: row.retailer_name,
    state: row.state,
    revision: row.revision,
    ownerSubject: row.owner_subject,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    deliveryAddress: row.delivery_address,
    deliveryCity: row.delivery_city,
    deliveryState: row.delivery_state,
    deliveryInstructions: row.delivery_instructions,
    whatsappConsent: row.whatsapp_consent,
    emailNotificationsConsent: row.email_notifications_consent,
    lines: lineRows.map((line) => ({
      slug: line.product_slug,
      brand: line.product_brand,
      name: line.product_name,
      size: line.product_size,
      image: line.product_image,
      quantity: line.quantity,
      observedUnitPriceNgn: line.observed_unit_price_ngn,
      observedListingUrl: line.observed_listing_url,
    })),
    quote,
    events: eventRows.map<AssistedOrderEventView>((event) => ({
      id: event.id,
      action: event.action,
      fromState: event.from_state,
      toState: event.to_state,
      reason: event.reason,
      createdAt: event.created_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function expireAssistedOrderQuotes(orderId?: string) {
  if (assistedOrderFixtureEnabled()) {
    const expiredOrderIds: string[] = [];
    for (const order of fixtureStore().orders.values()) {
      if (orderId && order.id !== orderId) continue;
      if (
        order.state !== "awaiting_approval" ||
        order.quote?.status !== "awaiting_approval"
      )
        continue;
      if (new Date(order.quote.expiresAt).valueOf() > Date.now()) continue;
      order.quote.status = "expired";
      order.state = "needs_response";
      order.revision += 1;
      order.updatedAt = new Date().toISOString();
      const eventId = randomUUID();
      order.events.push({
        id: eventId,
        action: "quote_expired",
        fromState: "awaiting_approval",
        toState: "needs_response",
        reason: "Quote expired before approval.",
        createdAt: order.updatedAt,
      });
      recordOrderNotificationDevelopmentFixture({
        orderId: order.id,
        orderReference: order.reference,
        retailer: order.retailer,
        ownerSubject: order.ownerSubject,
        contactEmail: order.contactEmail,
        contactName: order.contactName,
        emailEnabled: order.emailNotificationsConsent,
        eventId,
        action: "quote_expired",
        createdAt: order.updatedAt,
      });
      expiredOrderIds.push(order.id);
    }
    for (const expiredOrderId of expiredOrderIds) {
      await deliverPendingAssistedOrderNotifications({
        orderId: expiredOrderId,
      });
    }
    return;
  }

  const sql = getPostgresClient();
  const expiredOrderIds = await sql.begin(async (transaction) => {
    const rows = await transaction<
      {
        order_id: string;
        quote_id: string;
        quote_version: number;
      }[]
    >`
      select orders.id as order_id, quote.id as quote_id, quote.version as quote_version
      from assisted_orders orders
      join assisted_order_quotes quote on quote.order_id = orders.id
      where orders.state = 'awaiting_approval'
        and quote.status = 'awaiting_approval'
        and quote.expires_at <= now()
        and (${orderId ?? null}::uuid is null or orders.id = ${orderId ?? null}::uuid)
      for update of orders, quote skip locked
    `;
    for (const row of rows) {
      await transaction`
        update assisted_order_quotes set status = 'expired'
        where id = ${row.quote_id} and status = 'awaiting_approval'
      `;
      await transaction`
        update assisted_orders
        set state = 'needs_response', revision = revision + 1, updated_at = now()
        where id = ${row.order_id} and state = 'awaiting_approval'
      `;
      await transaction`
        insert into assisted_order_events (
          order_id, actor_kind, action, from_state, to_state, quote_version, reason
        ) values (
          ${row.order_id}, 'system', 'quote_expired', 'awaiting_approval',
          'needs_response', ${row.quote_version}, 'Quote expired before approval.'
        )
      `;
    }
    return rows.map((row) => row.order_id);
  });
  for (const expiredOrderId of expiredOrderIds) {
    await deliverPendingAssistedOrderNotifications({ orderId: expiredOrderId });
  }
}

const orderSelect = `
  select orders.id, orders.public_reference, orders.owner_subject,
         orders.retailer_name, orders.state, orders.revision,
         orders.contact_name, orders.contact_email, orders.contact_phone,
         orders.delivery_address, orders.delivery_city, orders.delivery_state,
         orders.delivery_instructions,
         (orders.whatsapp_consent_at is not null) as whatsapp_consent,
         (orders.email_notifications_consent_at is not null) as email_notifications_consent,
         orders.created_at::text as created_at,
         orders.updated_at::text as updated_at
  from assisted_orders orders
`;

export async function createAssistedOrder(record: CreateAssistedOrderRecord) {
  if (assistedOrderFixtureEnabled()) return createFixtureOrder(record);
  const sql = getPostgresClient();
  const orderId = await sql.begin(async (transaction) => {
    const identities = await transaction<
      { identity_version_id: string; slug_at_review: string }[]
    >`
      select identity_version_id, slug_at_review
      from catalogue_product_identity_versions
      where slug_at_review in ${transaction(record.lines.map((line) => line.slug))}
        and lifecycle_state = 'active'
    `;
    const identityBySlug = new Map(
      identities.map((row) => [row.slug_at_review, row.identity_version_id]),
    );
    const [createdOrder] = await transaction<{ id: string }[]>`
      insert into assisted_orders (
        request_key_hash, request_fingerprint, public_reference, owner_subject,
        retailer_name, contact_name, contact_email,
        contact_phone, delivery_address, delivery_city, delivery_state,
        delivery_instructions, whatsapp_consent_at, whatsapp_consent_policy,
        email_notifications_consent_at, email_notifications_consent_policy
      ) values (
        ${record.requestKeyHash}, ${record.requestFingerprint}, ${record.reference},
        ${record.ownerSubject}, ${record.retailer}, ${record.contactName},
        ${record.contactEmail}, ${record.contactPhone}, ${record.deliveryAddress},
        ${record.deliveryCity}, ${record.deliveryState}, ${record.deliveryInstructions},
        ${record.whatsappConsent ? transaction`now()` : null},
        ${record.whatsappConsent ? "assisted-procurement-v1" : null},
        ${record.emailNotificationsConsent ? transaction`now()` : null},
        ${record.emailNotificationsConsent ? "assisted-order-email-v1" : null}
      ) on conflict (request_key_hash) do nothing returning id
    `;
    const [order] = createdOrder
      ? [createdOrder]
      : await transaction<{ id: string; request_fingerprint: string }[]>`
      select id, request_fingerprint from assisted_orders
      where request_key_hash = ${record.requestKeyHash} and retain_until > now()
      for update
    `;
    if (
      !order ||
      ("request_fingerprint" in order &&
        order.request_fingerprint !== record.requestFingerprint)
    ) {
      throw new Error("order_idempotency_conflict");
    }

    if (!createdOrder) {
      await transaction`
        update assisted_order_guest_sessions set revoked_at = now()
        where order_id = ${order.id} and revoked_at is null
      `;
      await transaction`
        update assisted_order_recovery_capabilities set invalidated_at = now()
        where order_id = ${order.id} and consumed_at is null and invalidated_at is null
      `;
      await transaction`
        insert into assisted_order_guest_sessions (token_hash, order_id, expires_at)
        values (${record.sessionHash}, ${order.id}, now() + ${assistedOrderCookieMaxAge} * interval '1 second')
      `;
      await transaction`
        insert into assisted_order_recovery_capabilities (token_hash, order_id, expires_at)
        values (${record.recoveryHash}, ${order.id}, now() + ${assistedOrderRecoveryMaxAge} * interval '1 second')
      `;
      return order.id;
    }

    for (const line of record.lines) {
      await transaction`
        insert into assisted_order_lines (
          order_id, product_identity_version_id, product_slug, product_brand,
          product_name, product_size, product_image, quantity,
          observed_unit_price_ngn, observed_listing_url,
          observed_evidence_reference, observed_at
        ) values (
          ${order.id}, ${identityBySlug.get(line.slug) ?? null}, ${line.slug}, ${line.brand},
          ${line.name}, ${line.size}, ${line.image}, ${line.quantity},
          ${line.observedUnitPriceNgn}, ${line.observedListingUrl},
          ${line.observedEvidenceReference}, ${line.observedAt}
        )
      `;
    }

    await transaction`
      insert into assisted_order_guest_sessions (token_hash, order_id, expires_at)
      values (${record.sessionHash}, ${order.id}, now() + ${assistedOrderCookieMaxAge} * interval '1 second')
    `;
    await transaction`
      insert into assisted_order_recovery_capabilities (token_hash, order_id, expires_at)
      values (${record.recoveryHash}, ${order.id}, now() + ${assistedOrderRecoveryMaxAge} * interval '1 second')
    `;
    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state, metadata
      ) values (
        ${order.id}, ${record.ownerSubject ? "customer" : "guest"}, ${record.ownerSubject},
        'order_requested', null, 'requested',
        ${transaction.json({ retailer: record.retailer, lineCount: record.lines.length })}
      )
    `;
    return order.id;
  });
  return (await readAssistedOrderById(orderId))!;
}

async function readAssistedOrderById(id: string) {
  await expireAssistedOrderQuotes(id);
  if (assistedOrderFixtureEnabled())
    return fixtureStore().orders.get(id) ?? null;
  const sql = getPostgresClient();
  const [row] = await sql.unsafe<OrderRow[]>(
    `${orderSelect}
    where orders.id = $1 and orders.retain_until > now() limit 1`,
    [id],
  );
  return row ? hydrateOrder(sql, row) : null;
}

export async function readAssistedOrderBySession(sessionHash: string) {
  if (assistedOrderFixtureEnabled()) {
    const id = fixtureStore().sessions.get(sessionHash);
    if (id) await expireAssistedOrderQuotes(id);
    return id ? (fixtureStore().orders.get(id) ?? null) : null;
  }
  const sql = getPostgresClient();
  await expireAssistedOrderQuotes();
  const [row] = await sql.unsafe<OrderRow[]>(
    `${orderSelect}
    join assisted_order_guest_sessions session on session.order_id = orders.id
    where session.token_hash = $1 and session.expires_at > now() and session.revoked_at is null
      and orders.retain_until > now() limit 1`,
    [sessionHash],
  );
  return row ? hydrateOrder(sql, row) : null;
}

export async function readAssistedOrderForOwner(
  orderId: string,
  ownerSubject: string,
) {
  await expireAssistedOrderQuotes(orderId);
  if (assistedOrderFixtureEnabled()) {
    const order = fixtureStore().orders.get(orderId);
    return order?.ownerSubject === ownerSubject ? order : null;
  }
  const sql = getPostgresClient();
  const [row] = await sql.unsafe<OrderRow[]>(
    `${orderSelect}
    where orders.id = $1 and orders.owner_subject = $2
      and orders.retain_until > now() limit 1`,
    [orderId, ownerSubject],
  );
  return row ? hydrateOrder(sql, row) : null;
}

export async function listAssistedOrdersForOwner(ownerSubject: string) {
  await expireAssistedOrderQuotes();
  if (assistedOrderFixtureEnabled()) {
    return Array.from(fixtureStore().orders.values())
      .filter((order) => order.ownerSubject === ownerSubject)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const sql = getPostgresClient();
  const rows = await sql.unsafe<OrderRow[]>(
    `${orderSelect}
    where orders.owner_subject = $1 and orders.retain_until > now()
    order by orders.created_at desc limit 100`,
    [ownerSubject],
  );
  return Promise.all(rows.map((row) => hydrateOrder(sql, row)));
}

export async function exchangeAssistedOrderRecovery(
  recoveryHash: string,
  sessionHash: string,
) {
  if (assistedOrderFixtureEnabled()) {
    const store = fixtureStore();
    const recovery = store.recoveries.get(recoveryHash);
    if (!recovery || recovery.consumed || recovery.expiresAt <= Date.now())
      return null;
    recovery.consumed = true;
    for (const [hash, orderId] of store.sessions)
      if (orderId === recovery.orderId) store.sessions.delete(hash);
    store.sessions.set(sessionHash, recovery.orderId);
    return store.orders.get(recovery.orderId) ?? null;
  }
  const sql = getPostgresClient();
  const orderId = await sql.begin(async (transaction) => {
    const [recovery] = await transaction<{ order_id: string }[]>`
      update assisted_order_recovery_capabilities
      set consumed_at = now()
      where token_hash = ${recoveryHash}
        and expires_at > now() and consumed_at is null and invalidated_at is null
      returning order_id
    `;
    if (!recovery) return null;
    await transaction`
      update assisted_order_guest_sessions set revoked_at = now()
      where order_id = ${recovery.order_id} and revoked_at is null
    `;
    await transaction`
      insert into assisted_order_guest_sessions (token_hash, order_id, expires_at)
      values (${sessionHash}, ${recovery.order_id}, now() + ${assistedOrderCookieMaxAge} * interval '1 second')
    `;
    return recovery.order_id;
  });
  return orderId ? readAssistedOrderById(orderId) : null;
}

export async function replaceAssistedOrderRecovery(input: {
  reference: string;
  contactEmail: string;
  recoveryHash: string;
}) {
  if (assistedOrderFixtureEnabled()) {
    const store = fixtureStore();
    const order = Array.from(store.orders.values()).find(
      (candidate) =>
        candidate.reference === input.reference &&
        candidate.contactEmail.toLocaleLowerCase("en") ===
          input.contactEmail.toLocaleLowerCase("en"),
    );
    if (!order) return null;
    for (const [hash, recovery] of store.recoveries)
      if (recovery.orderId === order.id) store.recoveries.delete(hash);
    store.recoveries.set(input.recoveryHash, {
      orderId: order.id,
      expiresAt: Date.now() + assistedOrderRecoveryMaxAge * 1000,
      consumed: false,
    });
    return {
      reference: order.reference,
      contactEmail: order.contactEmail,
      contactName: order.contactName,
    };
  }
  const sql = getPostgresClient();
  return sql.begin(async (transaction) => {
    const [order] = await transaction<
      {
        id: string;
        public_reference: string;
        contact_email: string;
        contact_name: string;
      }[]
    >`
      select id, public_reference, contact_email, contact_name
      from assisted_orders
      where public_reference = ${input.reference}
        and lower(contact_email) = lower(${input.contactEmail})
        and retain_until > now()
      for update
    `;
    if (!order) return null;
    await transaction`
      update assisted_order_recovery_capabilities set invalidated_at = now()
      where order_id = ${order.id} and consumed_at is null and invalidated_at is null
    `;
    await transaction`
      insert into assisted_order_recovery_capabilities (token_hash, order_id, expires_at)
      values (${input.recoveryHash}, ${order.id}, now() + ${assistedOrderRecoveryMaxAge} * interval '1 second')
    `;
    return {
      reference: order.public_reference,
      contactEmail: order.contact_email,
      contactName: order.contact_name,
    };
  });
}

export async function updateAssistedOrderNotificationPreference(input: {
  orderId?: string;
  sessionHash?: string;
  ownerSubject?: string;
  enabled: boolean;
}) {
  if (assistedOrderFixtureEnabled()) {
    const store = fixtureStore();
    const order = input.orderId ? store.orders.get(input.orderId) : undefined;
    const sessionOrderId = input.sessionHash
      ? store.sessions.get(input.sessionHash)
      : undefined;
    const candidate =
      order ?? (sessionOrderId ? store.orders.get(sessionOrderId) : undefined);
    const ownerOwns = Boolean(
      input.ownerSubject && candidate?.ownerSubject === input.ownerSubject,
    );
    const sessionOwns = Boolean(
      sessionOrderId && candidate?.id === sessionOrderId,
    );
    if (!candidate || (!ownerOwns && !sessionOwns)) return null;
    candidate.emailNotificationsConsent = input.enabled;
    setOrderNotificationPreferenceDevelopmentFixture(
      candidate.id,
      input.enabled,
    );
    candidate.updatedAt = new Date().toISOString();
    const eventId = randomUUID();
    candidate.events.push({
      id: eventId,
      action: "notification_preference_updated",
      fromState: candidate.state,
      toState: candidate.state,
      reason: input.enabled
        ? "Email order updates enabled."
        : "Email order updates disabled.",
      createdAt: candidate.updatedAt,
    });
    return candidate;
  }

  const sql = getPostgresClient();
  const id = await sql.begin(async (transaction) => {
    const [order] = await transaction<
      { id: string; state: AssistedOrderState }[]
    >`
      select orders.id, orders.state
      from assisted_orders orders
      left join assisted_order_guest_sessions session
        on session.order_id = orders.id
        and session.token_hash = ${input.sessionHash ?? ""}
        and session.expires_at > now() and session.revoked_at is null
      where orders.retain_until > now()
        and (
          (${input.ownerSubject ?? null}::text is not null
            and orders.id = ${input.orderId ?? null}::uuid
            and orders.owner_subject = ${input.ownerSubject ?? null})
          or (${input.sessionHash ?? null}::text is not null and session.order_id is not null)
        )
      for update of orders
      limit 1
    `;
    if (!order) return null;
    await transaction`
      update assisted_orders
      set email_notifications_consent_at = ${input.enabled ? transaction`now()` : null},
          email_notifications_consent_policy = ${input.enabled ? "assisted-order-email-v1" : null},
          updated_at = now()
      where id = ${order.id}
    `;
    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state, reason
      ) values (
        ${order.id}, ${input.ownerSubject ? "customer" : "guest"}, ${input.ownerSubject ?? null},
        'notification_preference_updated', ${order.state}, ${order.state},
        ${input.enabled ? "Email order updates enabled." : "Email order updates disabled."}
      )
    `;
    if (!input.enabled) {
      await transaction`
        update assisted_order_notifications
        set email_status = 'suppressed', email_failure_code = 'consent_withdrawn', updated_at = now()
        where order_id = ${order.id} and email_status in ('pending', 'failed')
      `;
    }
    return order.id;
  });
  return id ? readAssistedOrderById(id) : null;
}

export async function decideAssistedOrderQuote(input: {
  orderId: string;
  sessionHash?: string;
  ownerSubject?: string;
  quoteVersion: number;
  revision: number;
  decision: "approve" | "decline";
  reason: string | null;
}) {
  if (assistedOrderFixtureEnabled()) return decideFixtureQuote(input);
  const sql = getPostgresClient();
  const updatedId = await sql.begin(async (transaction) => {
    const [order] = await transaction<
      { id: string; state: AssistedOrderState }[]
    >`
      select orders.id, orders.state
      from assisted_orders orders
      left join assisted_order_guest_sessions session
        on session.order_id = orders.id and session.token_hash = ${input.sessionHash ?? ""}
        and session.expires_at > now() and session.revoked_at is null
      where orders.id = ${input.orderId}
        and orders.revision = ${input.revision}
        and orders.state = 'awaiting_approval'
        and (
          (${input.ownerSubject ?? null}::text is not null and orders.owner_subject = ${input.ownerSubject ?? null})
          or session.order_id is not null
        )
      for update of orders
    `;
    if (!order) return null;
    const [quote] = await transaction<{ id: string }[]>`
      update assisted_order_quotes
      set status = ${input.decision === "approve" ? "approved" : "declined"},
          approved_at = ${input.decision === "approve" ? transaction`now()` : null}
      where order_id = ${order.id} and version = ${input.quoteVersion}
        and status = 'awaiting_approval' and expires_at > now()
      returning id
    `;
    if (!quote) return null;
    const nextState =
      input.decision === "approve" ? "payment_pending" : "needs_response";
    await transaction`
      update assisted_orders set state = ${nextState}, revision = revision + 1, updated_at = now()
      where id = ${order.id}
    `;
    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state,
        quote_version, reason
      ) values (
        ${order.id}, ${input.ownerSubject ? "customer" : "guest"}, ${input.ownerSubject ?? null},
        ${input.decision === "approve" ? "quote_approved" : "quote_declined"},
        'awaiting_approval', ${nextState}, ${input.quoteVersion}, ${input.reason}
      )
    `;
    return order.id;
  });
  return updatedId ? readAssistedOrderById(updatedId) : null;
}

export async function listAssistedOrderQueue() {
  await expireAssistedOrderQuotes();
  if (assistedOrderFixtureEnabled()) {
    return Array.from(fixtureStore().orders.values()).sort((a, b) =>
      a.updatedAt.localeCompare(b.updatedAt),
    );
  }
  const sql = getPostgresClient();
  const rows = await sql.unsafe<OrderRow[]>(`${orderSelect}
    where state not in ('delivered', 'cancelled', 'refunded') and retain_until > now()
    order by updated_at asc limit 200`);
  return Promise.all(rows.map((row) => hydrateOrder(sql, row)));
}

export async function transitionAssistedOrderForOperator(input: {
  orderId: string;
  revision: number;
  operatorSubject: string;
  toState: "quoting" | "cancelled";
  reason: string | null;
}) {
  if (assistedOrderFixtureEnabled()) return transitionFixtureOrder(input);
  const sql = getPostgresClient();
  const id = await sql.begin(async (transaction) => {
    const allowedFrom =
      input.toState === "quoting"
        ? ["requested", "needs_response"]
        : [
            "requested",
            "quoting",
            "awaiting_approval",
            "needs_response",
            "payment_pending",
          ];
    const [order] = await transaction<
      { id: string; state: AssistedOrderState }[]
    >`
      select id, state from assisted_orders
      where id = ${input.orderId} and revision = ${input.revision}
        and state in ${transaction(allowedFrom)} for update
    `;
    if (!order) return null;
    await transaction`
      update assisted_orders set state = ${input.toState}, revision = revision + 1, updated_at = now()
      where id = ${order.id}
    `;
    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state, reason
      ) values (
        ${order.id}, 'operator', ${input.operatorSubject},
        ${input.toState === "quoting" ? "quoting_started" : "order_cancelled"},
        ${order.state}, ${input.toState}, ${input.reason}
      )
    `;
    return order.id;
  });
  return id ? readAssistedOrderById(id) : null;
}

export async function submitAssistedOrderQuote(input: {
  orderId: string;
  revision: number;
  operatorSubject: string;
  components: AssistedOrderQuoteComponents;
  evidenceReference: string;
  notes: string | null;
  expiresAt: string;
}) {
  if (assistedOrderFixtureEnabled()) return submitFixtureQuote(input);
  const sql = getPostgresClient();
  const id = await sql.begin(async (transaction) => {
    const [order] = await transaction<
      { id: string; state: AssistedOrderState }[]
    >`
      select id, state from assisted_orders
      where id = ${input.orderId} and revision = ${input.revision} and state = 'quoting'
      for update
    `;
    if (!order) return null;
    const [versionRow] = await transaction<{ version: number }[]>`
      select coalesce(max(version), 0)::int + 1 as version
      from assisted_order_quotes where order_id = ${order.id}
    `;
    await transaction`
      update assisted_order_quotes set status = 'superseded'
      where order_id = ${order.id} and status = 'awaiting_approval'
    `;
    await transaction`
      insert into assisted_order_quotes (
        order_id, version, product_subtotal_ngn, retailer_fee_ngn, tax_ngn,
        jelocare_fee_ngn, delivery_ngn, evidence_reference, notes, expires_at,
        created_by_subject
      ) values (
        ${order.id}, ${versionRow.version}, ${input.components.productSubtotalNgn},
        ${input.components.retailerFeeNgn}, ${input.components.taxNgn},
        ${input.components.jelocareFeeNgn}, ${input.components.deliveryNgn},
        ${input.evidenceReference}, ${input.notes}, ${input.expiresAt}, ${input.operatorSubject}
      )
    `;
    await transaction`
      update assisted_orders set state = 'awaiting_approval', revision = revision + 1, updated_at = now()
      where id = ${order.id}
    `;
    await transaction`
      insert into assisted_order_events (
        order_id, actor_kind, actor_reference, action, from_state, to_state,
        quote_version, evidence_reference
      ) values (
        ${order.id}, 'operator', ${input.operatorSubject}, 'quote_issued',
        'quoting', 'awaiting_approval', ${versionRow.version}, ${input.evidenceReference}
      )
    `;
    return order.id;
  });
  return id ? readAssistedOrderById(id) : null;
}

function createFixtureOrder(
  record: CreateAssistedOrderRecord,
): AssistedOrderPrivateView {
  const store = fixtureStore();
  const existingRequest = store.requests.get(record.requestKeyHash);
  if (existingRequest) {
    if (existingRequest.fingerprint !== record.requestFingerprint)
      throw new Error("order_idempotency_conflict");
    for (const [hash, orderId] of store.sessions)
      if (orderId === existingRequest.orderId) store.sessions.delete(hash);
    for (const [hash, recovery] of store.recoveries)
      if (recovery.orderId === existingRequest.orderId)
        store.recoveries.delete(hash);
    store.sessions.set(record.sessionHash, existingRequest.orderId);
    store.recoveries.set(record.recoveryHash, {
      orderId: existingRequest.orderId,
      expiresAt: Date.now() + assistedOrderRecoveryMaxAge * 1000,
      consumed: false,
    });
    return store.orders.get(existingRequest.orderId)!;
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  const order: AssistedOrderPrivateView = {
    id,
    reference: record.reference,
    ownerSubject: record.ownerSubject,
    retailer: record.retailer,
    state: "requested",
    revision: 1,
    contactName: record.contactName,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    deliveryAddress: record.deliveryAddress,
    deliveryCity: record.deliveryCity,
    deliveryState: record.deliveryState,
    deliveryInstructions: record.deliveryInstructions,
    whatsappConsent: record.whatsappConsent,
    emailNotificationsConsent: record.emailNotificationsConsent,
    lines: record.lines.map((line) => ({
      slug: line.slug,
      brand: line.brand,
      name: line.name,
      size: line.size,
      image: line.image,
      quantity: line.quantity,
      observedUnitPriceNgn: line.observedUnitPriceNgn,
      observedListingUrl: line.observedListingUrl,
    })),
    quote: null,
    events: [
      {
        id: randomUUID(),
        action: "order_requested",
        fromState: null,
        toState: "requested",
        reason: null,
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  store.orders.set(id, order);
  store.requests.set(record.requestKeyHash, {
    orderId: id,
    fingerprint: record.requestFingerprint,
  });
  store.sessions.set(record.sessionHash, id);
  store.recoveries.set(record.recoveryHash, {
    orderId: id,
    expiresAt: Date.now() + assistedOrderRecoveryMaxAge * 1000,
    consumed: false,
  });
  return order;
}

function transitionFixtureOrder(input: {
  orderId: string;
  revision: number;
  operatorSubject: string;
  toState: "quoting" | "cancelled";
  reason: string | null;
}) {
  const order = fixtureStore().orders.get(input.orderId);
  const allowed =
    input.toState === "quoting"
      ? order?.state === "requested" || order?.state === "needs_response"
      : Boolean(
          order &&
          [
            "requested",
            "quoting",
            "awaiting_approval",
            "needs_response",
            "payment_pending",
          ].includes(order.state),
        );
  if (!order || order.revision !== input.revision || !allowed) return null;
  const from = order.state;
  order.state = input.toState;
  order.revision += 1;
  order.updatedAt = new Date().toISOString();
  const eventId = randomUUID();
  const action =
    input.toState === "quoting" ? "quoting_started" : "order_cancelled";
  order.events.push({
    id: eventId,
    action,
    fromState: from,
    toState: input.toState,
    reason: input.reason,
    createdAt: order.updatedAt,
  });
  recordOrderNotificationDevelopmentFixture({
    orderId: order.id,
    orderReference: order.reference,
    retailer: order.retailer,
    ownerSubject: order.ownerSubject,
    contactEmail: order.contactEmail,
    contactName: order.contactName,
    emailEnabled: order.emailNotificationsConsent,
    eventId,
    action,
    createdAt: order.updatedAt,
  });
  return order;
}

function submitFixtureQuote(input: {
  orderId: string;
  revision: number;
  operatorSubject: string;
  components: AssistedOrderQuoteComponents;
  evidenceReference: string;
  notes: string | null;
  expiresAt: string;
}) {
  const order = fixtureStore().orders.get(input.orderId);
  if (!order || order.revision !== input.revision || order.state !== "quoting")
    return null;
  const version = (order.quote?.version ?? 0) + 1;
  const totalNgn = Object.values(input.components).reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  order.quote = {
    id: randomUUID(),
    version,
    status: "awaiting_approval",
    components: input.components,
    totalNgn,
    evidenceReference: input.evidenceReference,
    notes: input.notes,
    issuedAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    approvedAt: null,
  };
  order.state = "awaiting_approval";
  order.revision += 1;
  order.updatedAt = new Date().toISOString();
  const eventId = randomUUID();
  order.events.push({
    id: eventId,
    action: "quote_issued",
    fromState: "quoting",
    toState: "awaiting_approval",
    reason: null,
    createdAt: order.updatedAt,
  });
  recordOrderNotificationDevelopmentFixture({
    orderId: order.id,
    orderReference: order.reference,
    retailer: order.retailer,
    ownerSubject: order.ownerSubject,
    contactEmail: order.contactEmail,
    contactName: order.contactName,
    emailEnabled: order.emailNotificationsConsent,
    eventId,
    action: "quote_issued",
    createdAt: order.updatedAt,
  });
  return order;
}

function decideFixtureQuote(input: {
  orderId: string;
  sessionHash?: string;
  ownerSubject?: string;
  quoteVersion: number;
  revision: number;
  decision: "approve" | "decline";
  reason: string | null;
}) {
  const store = fixtureStore();
  const order = store.orders.get(input.orderId);
  const sessionOwns =
    input.sessionHash &&
    store.sessions.get(input.sessionHash) === input.orderId;
  const ownerOwns =
    input.ownerSubject && order?.ownerSubject === input.ownerSubject;
  if (
    !order ||
    (!sessionOwns && !ownerOwns) ||
    order.revision !== input.revision ||
    order.state !== "awaiting_approval" ||
    order.quote?.version !== input.quoteVersion ||
    order.quote.status !== "awaiting_approval" ||
    new Date(order.quote.expiresAt) <= new Date()
  )
    return null;
  const nextState =
    input.decision === "approve" ? "payment_pending" : "needs_response";
  order.quote.status = input.decision === "approve" ? "approved" : "declined";
  order.quote.approvedAt =
    input.decision === "approve" ? new Date().toISOString() : null;
  order.state = nextState;
  order.revision += 1;
  order.updatedAt = new Date().toISOString();
  order.events.push({
    id: randomUUID(),
    action: input.decision === "approve" ? "quote_approved" : "quote_declined",
    fromState: "awaiting_approval",
    toState: nextState,
    reason: input.reason,
    createdAt: order.updatedAt,
  });
  return order;
}
