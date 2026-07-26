import 'server-only';

import type { Sql } from 'postgres';

function boundedLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

export type QueueCounts = {
  contributions: number;
  edges: number;
  observations: number;
  values: number;
  retailers: number;
  signals: number;
};

// Pending counts for the console overview, in one round-trip. Read-only.
export async function pendingQueueCounts(sql: Sql): Promise<QueueCounts> {
  const [row] = await sql<QueueCounts[]>`
    select
      (select count(*) from community_contributions where moderation_status = 'pending')::int as contributions,
      (select count(*) from community_knowledge_edges where moderation_status = 'pending')::int as edges,
      (select count(*) from community_observations where moderation_status = 'pending')::int as observations,
      (select count(*) from community_moderation_values where status = 'pending')::int as values,
      (select count(*) from retailer_partnership_applications where status = 'submitted')::int as retailers,
      (select count(*) from commerce_events)::int as signals
  `;
  return row;
}

// Read-only views of the moderation queues (ADR 0005 / 0007). Moderation input
// only: these read pending rows and never write, promote, or touch a canonical
// catalogue record. Timestamps are cast to text so the driver returns stable
// strings rather than Date objects.

export type PendingObservation = {
  id: string;
  contributionId: string;
  kind: 'price' | 'outcome';
  subjectKind: string;
  subjectRef: string;
  amountNgn: number | null;
  outcome: string | null;
  observedOn: string | null;
  createdAt: string;
};

export async function listPendingObservations(sql: Sql, limit = 100, offset = 0): Promise<PendingObservation[]> {
  const rows = await sql<{
    id: string;
    contribution_id: string;
    observation_kind: 'price' | 'outcome';
    subject_kind: string;
    subject_ref: string;
    amount_ngn: number | null;
    outcome: string | null;
    observed_on: string | null;
    created_at: string;
  }[]>`
    select observation.id, observation.contribution_id, observation.observation_kind,
           observation.subject_kind, observation.subject_ref, observation.amount_ngn,
           observation.outcome, observation.observed_on::text as observed_on,
           observation.created_at::text as created_at
    from community_observations observation
    join community_contributions contribution on contribution.id = observation.contribution_id
    where observation.moderation_status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
    order by observation.created_at asc
    limit ${boundedLimit(limit)} offset ${Math.max(0, Math.trunc(offset))}
  `;
  return rows.map(row => ({
    id: row.id,
    contributionId: row.contribution_id,
    kind: row.observation_kind,
    subjectKind: row.subject_kind,
    subjectRef: row.subject_ref,
    amountNgn: row.amount_ngn,
    outcome: row.outcome,
    observedOn: row.observed_on,
    createdAt: row.created_at,
  }));
}

export type PendingContribution = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  submittedAt: string;
  retainUntil: string;
};

export async function listPendingContributions(sql: Sql, limit = 100): Promise<PendingContribution[]> {
  const rows = await sql<{
    id: string;
    contribution_kind: string;
    payload: Record<string, unknown>;
    submitted_at: string;
    retain_until: string;
  }[]>`
    select id, contribution_kind, payload,
           submitted_at::text as submitted_at, retain_until::text as retain_until
    from community_contributions
    where moderation_status = 'pending'
    order by submitted_at desc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    kind: row.contribution_kind,
    payload: row.payload,
    submittedAt: row.submitted_at,
    retainUntil: row.retain_until,
  }));
}

export async function findPendingContribution(
  sql: Sql,
  id: string,
): Promise<PendingContribution | null> {
  const [row] = await sql<{
    id: string;
    contribution_kind: string;
    payload: Record<string, unknown>;
    submitted_at: string;
    retain_until: string;
  }[]>`
    select id, contribution_kind, payload,
           submitted_at::text as submitted_at, retain_until::text as retain_until
    from community_contributions
    where moderation_status = 'pending'
      and id = ${id}
    limit 1
  `;

  return row ? {
    id: row.id,
    kind: row.contribution_kind,
    payload: row.payload,
    submittedAt: row.submitted_at,
    retainUntil: row.retain_until,
  } : null;
}

export type PendingEdge = {
  id: string;
  contributionId: string;
  subjectKind: string;
  subjectRef: string;
  predicate: string;
  objectKind: string;
  objectRef: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function listPendingEdges(sql: Sql, limit = 100): Promise<PendingEdge[]> {
  const rows = await sql<{
    id: string;
    contribution_id: string;
    subject_kind: string;
    subject_ref: string;
    predicate: string;
    object_kind: string;
    object_ref: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[]>`
    select id, contribution_id, subject_kind, subject_ref, predicate,
           object_kind, object_ref, metadata, created_at::text as created_at
    from community_knowledge_edges
    where moderation_status = 'pending'
    order by created_at desc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    contributionId: row.contribution_id,
    subjectKind: row.subject_kind,
    subjectRef: row.subject_ref,
    predicate: row.predicate,
    objectKind: row.object_kind,
    objectRef: row.object_ref,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export async function findPendingEdge(sql: Sql, id: string): Promise<PendingEdge | null> {
  const [row] = await sql<{
    id: string;
    contribution_id: string;
    subject_kind: string;
    subject_ref: string;
    predicate: string;
    object_kind: string;
    object_ref: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[]>`
    select id, contribution_id, subject_kind, subject_ref, predicate,
           object_kind, object_ref, metadata, created_at::text as created_at
    from community_knowledge_edges
    where moderation_status = 'pending'
      and id = ${id}
    limit 1
  `;

  return row ? {
    id: row.id,
    contributionId: row.contribution_id,
    subjectKind: row.subject_kind,
    subjectRef: row.subject_ref,
    predicate: row.predicate,
    objectKind: row.object_kind,
    objectRef: row.object_ref,
    metadata: row.metadata,
    createdAt: row.created_at,
  } : null;
}

export type PendingModerationValue = {
  id: string;
  valueKind: string;
  rawValue: string;
  normalizedValue: string;
  occurrenceCount: number;
  canonicalEntityKind: string | null;
  canonicalEntityRef: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export async function listPendingModerationValues(sql: Sql, limit = 100): Promise<PendingModerationValue[]> {
  const rows = await sql<{
    id: string;
    value_kind: string;
    raw_value: string;
    normalized_value: string;
    occurrence_count: number;
    canonical_entity_kind: string | null;
    canonical_entity_ref: string | null;
    first_seen_at: string;
    last_seen_at: string;
  }[]>`
    select id, value_kind, raw_value, normalized_value, occurrence_count,
           canonical_entity_kind, canonical_entity_ref,
           first_seen_at::text as first_seen_at, last_seen_at::text as last_seen_at
    from community_moderation_values
    where status = 'pending'
    order by last_seen_at desc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    valueKind: row.value_kind,
    rawValue: row.raw_value,
    normalizedValue: row.normalized_value,
    occurrenceCount: row.occurrence_count,
    canonicalEntityKind: row.canonical_entity_kind,
    canonicalEntityRef: row.canonical_entity_ref,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));
}

export async function findPendingModerationValue(
  sql: Sql,
  id: string,
): Promise<PendingModerationValue | null> {
  const [row] = await sql<{
    id: string;
    value_kind: string;
    raw_value: string;
    normalized_value: string;
    occurrence_count: number;
    canonical_entity_kind: string | null;
    canonical_entity_ref: string | null;
    first_seen_at: string;
    last_seen_at: string;
  }[]>`
    select id, value_kind, raw_value, normalized_value, occurrence_count,
           canonical_entity_kind, canonical_entity_ref,
           first_seen_at::text as first_seen_at, last_seen_at::text as last_seen_at
    from community_moderation_values
    where status = 'pending'
      and id = ${id}
    limit 1
  `;

  return row ? {
    id: row.id,
    valueKind: row.value_kind,
    rawValue: row.raw_value,
    normalizedValue: row.normalized_value,
    occurrenceCount: row.occurrence_count,
    canonicalEntityKind: row.canonical_entity_kind,
    canonicalEntityRef: row.canonical_entity_ref,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  } : null;
}

export type PendingRetailerApplication = {
  id: string;
  storeName: string;
  email: string;
  emailVerifiedAt: string | null;
  contactConsentAt: string;
  payload: Record<string, unknown>;
  submittedAt: string | null;
};

// Never selects edit_secret_hash: the console reviews an application, it does not
// authenticate as the retailer.
export async function listPendingRetailerApplications(sql: Sql, limit = 100): Promise<PendingRetailerApplication[]> {
  const rows = await sql<{
    id: string;
    store_name: string;
    email: string;
    email_verified_at: string | null;
    contact_consent_at: string;
    payload: Record<string, unknown>;
    submitted_at: string | null;
  }[]>`
    select id, store_name, email, email_verified_at::text as email_verified_at,
           contact_consent_at::text as contact_consent_at, payload, submitted_at::text as submitted_at
    from retailer_partnership_applications
    where status = 'submitted'
    order by updated_at desc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    storeName: row.store_name,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    contactConsentAt: row.contact_consent_at,
    payload: row.payload,
    submittedAt: row.submitted_at,
  }));
}

export async function findPendingRetailerApplication(
  sql: Sql,
  id: string,
): Promise<PendingRetailerApplication | null> {
  const [row] = await sql<{
    id: string;
    store_name: string;
    email: string;
    email_verified_at: string | null;
    contact_consent_at: string;
    payload: Record<string, unknown>;
    submitted_at: string | null;
  }[]>`
    select id, store_name, email, email_verified_at::text as email_verified_at,
           contact_consent_at::text as contact_consent_at, payload, submitted_at::text as submitted_at
    from retailer_partnership_applications
    where status = 'submitted'
      and id = ${id}
    limit 1
  `;

  return row ? {
    id: row.id,
    storeName: row.store_name,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    contactConsentAt: row.contact_consent_at,
    payload: row.payload,
    submittedAt: row.submitted_at,
  } : null;
}

export type CommerceSignal = {
  id: string;
  eventType: string;
  productSlug: string;
  retailer: string;
  market: string;
  priceNgn: number | null;
  priceRank: string;
  position: number;
  freshnessDays: number | null;
  createdAt: string;
};

// Measurement only (ADR 0005 / 0006): a read-only window on store_click signals.
// Never joined to health-shaped behaviour and never an input to ranking.
export async function listCommerceSignals(sql: Sql, limit = 100): Promise<CommerceSignal[]> {
  const rows = await sql<{
    id: string;
    event_type: string;
    product_slug: string;
    retailer: string;
    market: string;
    price_ngn: number | null;
    price_rank: string;
    position: number;
    freshness_days: number | null;
    created_at: string;
  }[]>`
    select id, event_type, product_slug, retailer, market, price_ngn, price_rank,
           position, freshness_days, created_at::text as created_at
    from commerce_events
    order by created_at desc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    eventType: row.event_type,
    productSlug: row.product_slug,
    retailer: row.retailer,
    market: row.market,
    priceNgn: row.price_ngn,
    priceRank: row.price_rank,
    position: row.position,
    freshnessDays: row.freshness_days,
    createdAt: row.created_at,
  }));
}
