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
      (
        select count(*)
        from community_contributions contribution
        where contribution.moderation_status = 'pending'
          and contribution.retain_until > now()
      )::int as contributions,
      (
        select count(*)
        from community_knowledge_edges edge
        join community_contributions contribution on contribution.id = edge.contribution_id
        where edge.moderation_status = 'pending'
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
      )::int as edges,
      (
        select count(*)
        from community_observations observation
        join community_contributions contribution on contribution.id = observation.contribution_id
        where observation.moderation_status = 'pending'
          and contribution.moderation_status <> 'rejected'
          and contribution.retain_until > now()
      )::int as observations,
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
  kind: 'product' | 'routine' | 'store';
  payload: Record<string, unknown>;
  submittedAt: string;
  retainUntil: string;
  pendingEdgeCount: number;
  pendingObservationCount: number;
  attribution: {
    source: string;
    medium: string | null;
    campaign: string | null;
  } | null;
};

export async function listPendingContributions(sql: Sql, limit = 100): Promise<PendingContribution[]> {
  const rows = await sql<{
    id: string;
    contribution_kind: PendingContribution['kind'];
    payload: Record<string, unknown>;
    submitted_at: string;
    retain_until: string;
    pending_edge_count: number;
    pending_observation_count: number;
    attribution_source: string | null;
    attribution_medium: string | null;
    attribution_campaign: string | null;
  }[]>`
    select contribution.id, contribution.contribution_kind, contribution.payload,
           contribution.submitted_at::text as submitted_at,
           contribution.retain_until::text as retain_until,
           (
             select count(*)::int
             from community_knowledge_edges edge
             where edge.contribution_id = contribution.id
               and edge.moderation_status = 'pending'
           ) as pending_edge_count,
           (
             select count(*)::int
             from community_observations observation
             where observation.contribution_id = contribution.id
               and observation.moderation_status = 'pending'
           ) as pending_observation_count,
           attribution.source as attribution_source,
           attribution.medium as attribution_medium,
           attribution.campaign as attribution_campaign
    from community_contributions contribution
    left join community_intake_attributions attribution
      on attribution.draft_id = contribution.draft_id
    where contribution.moderation_status = 'pending'
      and contribution.retain_until > now()
    order by contribution.submitted_at asc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    kind: row.contribution_kind,
    payload: row.payload,
    submittedAt: row.submitted_at,
    retainUntil: row.retain_until,
    pendingEdgeCount: row.pending_edge_count,
    pendingObservationCount: row.pending_observation_count,
    attribution: row.attribution_source ? {
      source: row.attribution_source,
      medium: row.attribution_medium,
      campaign: row.attribution_campaign,
    } : null,
  }));
}

export async function findPendingContribution(
  sql: Sql,
  id: string,
): Promise<PendingContribution | null> {
  const [row] = await sql<{
    id: string;
    contribution_kind: PendingContribution['kind'];
    payload: Record<string, unknown>;
    submitted_at: string;
    retain_until: string;
    pending_edge_count: number;
    pending_observation_count: number;
    attribution_source: string | null;
    attribution_medium: string | null;
    attribution_campaign: string | null;
  }[]>`
    select contribution.id, contribution.contribution_kind, contribution.payload,
           contribution.submitted_at::text as submitted_at,
           contribution.retain_until::text as retain_until,
           (
             select count(*)::int
             from community_knowledge_edges edge
             where edge.contribution_id = contribution.id
               and edge.moderation_status = 'pending'
           ) as pending_edge_count,
           (
             select count(*)::int
             from community_observations observation
             where observation.contribution_id = contribution.id
               and observation.moderation_status = 'pending'
           ) as pending_observation_count,
           attribution.source as attribution_source,
           attribution.medium as attribution_medium,
           attribution.campaign as attribution_campaign
    from community_contributions contribution
    left join community_intake_attributions attribution
      on attribution.draft_id = contribution.draft_id
    where contribution.moderation_status = 'pending'
      and contribution.retain_until > now()
      and contribution.id = ${id}
    limit 1
  `;

  return row ? {
    id: row.id,
    kind: row.contribution_kind,
    payload: row.payload,
    submittedAt: row.submitted_at,
    retainUntil: row.retain_until,
    pendingEdgeCount: row.pending_edge_count,
    pendingObservationCount: row.pending_observation_count,
    attribution: row.attribution_source ? {
      source: row.attribution_source,
      medium: row.attribution_medium,
      campaign: row.attribution_campaign,
    } : null,
  } : null;
}

export type PendingEdge = {
  id: string;
  contributionId: string;
  contributionKind: 'product' | 'routine' | 'store';
  contributionPayload: Record<string, unknown>;
  subjectKind: string;
  subjectRef: string;
  predicate: string;
  objectKind: string;
  objectRef: string;
  confidenceState: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PendingEdgeCursor = {
  createdAt: string;
  id: string;
};

export async function listPendingEdges(
  sql: Sql,
  limit = 100,
  after?: PendingEdgeCursor,
): Promise<PendingEdge[]> {
  const afterCursor = after
    ? sql`
        and (edge.created_at, edge.id) > (
          ${after.createdAt}::timestamptz,
          ${after.id}::uuid
        )
      `
    : sql``;
  const rows = await sql<{
    id: string;
    contribution_id: string;
    contribution_kind: PendingEdge['contributionKind'];
    contribution_payload: Record<string, unknown>;
    subject_kind: string;
    subject_ref: string;
    predicate: string;
    object_kind: string;
    object_ref: string;
    confidence_state: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[]>`
    select edge.id, edge.contribution_id,
           contribution.contribution_kind,
           contribution.payload as contribution_payload,
           edge.subject_kind, edge.subject_ref, edge.predicate,
           edge.object_kind, edge.object_ref, edge.confidence_state,
           edge.metadata, edge.created_at::text as created_at
    from community_knowledge_edges edge
    join community_contributions contribution on contribution.id = edge.contribution_id
    where edge.moderation_status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
      ${afterCursor}
    order by edge.created_at asc, edge.id asc
    limit ${boundedLimit(limit)}
  `;
  return rows.map(row => ({
    id: row.id,
    contributionId: row.contribution_id,
    contributionKind: row.contribution_kind,
    contributionPayload: row.contribution_payload,
    subjectKind: row.subject_kind,
    subjectRef: row.subject_ref,
    predicate: row.predicate,
    objectKind: row.object_kind,
    objectRef: row.object_ref,
    confidenceState: row.confidence_state,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

export async function findPendingEdge(sql: Sql, id: string): Promise<PendingEdge | null> {
  const [row] = await sql<{
    id: string;
    contribution_id: string;
    contribution_kind: PendingEdge['contributionKind'];
    contribution_payload: Record<string, unknown>;
    subject_kind: string;
    subject_ref: string;
    predicate: string;
    object_kind: string;
    object_ref: string;
    confidence_state: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[]>`
    select edge.id, edge.contribution_id,
           contribution.contribution_kind,
           contribution.payload as contribution_payload,
           edge.subject_kind, edge.subject_ref, edge.predicate,
           edge.object_kind, edge.object_ref, edge.confidence_state,
           edge.metadata, edge.created_at::text as created_at
    from community_knowledge_edges edge
    join community_contributions contribution on contribution.id = edge.contribution_id
    where edge.moderation_status = 'pending'
      and contribution.moderation_status <> 'rejected'
      and contribution.retain_until > now()
      and edge.id = ${id}
    limit 1
  `;

  return row ? {
    id: row.id,
    contributionId: row.contribution_id,
    contributionKind: row.contribution_kind,
    contributionPayload: row.contribution_payload,
    subjectKind: row.subject_kind,
    subjectRef: row.subject_ref,
    predicate: row.predicate,
    objectKind: row.object_kind,
    objectRef: row.object_ref,
    confidenceState: row.confidence_state,
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

export type CommercePriceChoice = 'lowest' | 'median' | 'higher' | 'only' | 'marketplace';

export type CommerceSignalMonitor = {
  asOf: string;
  last7DaysCount: number;
  previous7DaysCount: number;
  last30DaysCount: number;
  lastRecordedAt: string | null;
  priceChoices: {
    choice: CommercePriceChoice;
    count: number;
  }[];
  topProducts: {
    productSlug: string;
    visitCount: number;
    storeCount: number;
    lastVisitedAt: string;
  }[];
  topRetailers: {
    retailer: string;
    visitCount: number;
    productCount: number;
    lastVisitedAt: string;
  }[];
  recentVisits: {
    id: string;
    productSlug: string;
    retailer: string;
    market: 'NG' | 'US';
    priceNgn: number | null;
    priceChoice: CommercePriceChoice;
    position: number;
    freshnessDays: number | null;
    createdAt: string;
  }[];
};

// Measurement only (ADR 0005 / 0006): a read-only window on store_click signals.
// Never joined to health-shaped behaviour and never an input to ranking.
export async function getCommerceSignalMonitor(sql: Sql): Promise<CommerceSignalMonitor> {
  const [summaryRows, priceChoiceRows, productRows, retailerRows, recentRows] = await Promise.all([
    sql<{
      as_of: string;
      last_7_days_count: number;
      previous_7_days_count: number;
      last_30_days_count: number;
      last_recorded_at: string | null;
    }[]>`
      select now()::text as as_of,
             count(*) filter (where created_at >= now() - interval '7 days')::int as last_7_days_count,
             count(*) filter (
               where created_at >= now() - interval '14 days'
                 and created_at < now() - interval '7 days'
             )::int as previous_7_days_count,
             count(*) filter (where created_at >= now() - interval '30 days')::int as last_30_days_count,
             max(created_at)::text as last_recorded_at
      from commerce_events
      where event_type = 'store_click'
    `,
    sql<{
      price_rank: CommercePriceChoice;
      visit_count: number;
    }[]>`
      select price_rank, count(*)::int as visit_count
      from commerce_events
      where event_type = 'store_click'
        and created_at >= now() - interval '30 days'
      group by price_rank
      order by visit_count desc, price_rank asc
    `,
    sql<{
      product_slug: string;
      visit_count: number;
      store_count: number;
      last_visited_at: string;
    }[]>`
      select product_slug, count(*)::int as visit_count,
             count(distinct retailer)::int as store_count,
             max(created_at)::text as last_visited_at
      from commerce_events
      where event_type = 'store_click'
        and created_at >= now() - interval '30 days'
      group by product_slug
      order by visit_count desc, last_visited_at desc, product_slug asc
      limit 8
    `,
    sql<{
      retailer: string;
      visit_count: number;
      product_count: number;
      last_visited_at: string;
    }[]>`
      select retailer, count(*)::int as visit_count,
             count(distinct product_slug)::int as product_count,
             max(created_at)::text as last_visited_at
      from commerce_events
      where event_type = 'store_click'
        and created_at >= now() - interval '30 days'
      group by retailer
      order by visit_count desc, last_visited_at desc, retailer asc
      limit 8
    `,
    sql<{
      id: string;
      product_slug: string;
      retailer: string;
      market: 'NG' | 'US';
      price_ngn: number | null;
      price_rank: CommercePriceChoice;
      position: number;
      freshness_days: number | null;
      created_at: string;
    }[]>`
      select id, product_slug, retailer, market, price_ngn, price_rank,
             position, freshness_days, created_at::text as created_at
      from commerce_events
      where event_type = 'store_click'
      order by created_at desc, id desc
      limit 20
    `,
  ]);
  const summary = summaryRows[0];
  if (!summary) throw new Error('Commerce signal summary unavailable.');

  return {
    asOf: summary.as_of,
    last7DaysCount: summary.last_7_days_count,
    previous7DaysCount: summary.previous_7_days_count,
    last30DaysCount: summary.last_30_days_count,
    lastRecordedAt: summary.last_recorded_at,
    priceChoices: priceChoiceRows.map(row => ({
      choice: row.price_rank,
      count: row.visit_count,
    })),
    topProducts: productRows.map(row => ({
      productSlug: row.product_slug,
      visitCount: row.visit_count,
      storeCount: row.store_count,
      lastVisitedAt: row.last_visited_at,
    })),
    topRetailers: retailerRows.map(row => ({
      retailer: row.retailer,
      visitCount: row.visit_count,
      productCount: row.product_count,
      lastVisitedAt: row.last_visited_at,
    })),
    recentVisits: recentRows.map(row => ({
      id: row.id,
      productSlug: row.product_slug,
      retailer: row.retailer,
      market: row.market,
      priceNgn: row.price_ngn,
      priceChoice: row.price_rank,
      position: row.position,
      freshnessDays: row.freshness_days,
      createdAt: row.created_at,
    })),
  };
}

export type ContributionAttributionMonitor = {
  asOf: string;
  last7DaysStarts: number;
  last7DaysCompletions: number;
  previous7DaysStarts: number;
  previous7DaysCompletions: number;
  last30DaysStarts: number;
  last30DaysCompletions: number;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  campaigns: {
    source: string;
    medium: string | null;
    campaign: string | null;
    content: string | null;
    starts: number;
    completions: number;
    lastStartedAt: string | null;
    lastCompletedAt: string | null;
  }[];
};

// Aggregate-only campaign measurement for the anonymous community intake.
// This deliberately carries no submission contents, identity, health context,
// click identifier, or device metadata. A submitted contribution counts as a
// completion even if moderation later rejects it: moderation evaluates quality,
// not whether someone completed the form.
export async function getContributionAttributionMonitor(
  sql: Sql,
): Promise<ContributionAttributionMonitor> {
  const [summaryRows, campaignRows] = await Promise.all([
    sql<{
      as_of: string;
      last_7_days_starts: number;
      last_7_days_completions: number;
      previous_7_days_starts: number;
      previous_7_days_completions: number;
      last_30_days_starts: number;
      last_30_days_completions: number;
      last_started_at: string | null;
      last_completed_at: string | null;
    }[]>`
      select now()::text as as_of,
             (
               select count(*)::int
               from community_intake_attributions attribution
               where attribution.retain_until > now()
                 and attribution.captured_at >= now() - interval '7 days'
             ) as last_7_days_starts,
             (
               select count(*)::int
               from community_contributions contribution
               where contribution.retain_until > now()
                 and contribution.submitted_at >= now() - interval '7 days'
             ) as last_7_days_completions,
             (
               select count(*)::int
               from community_intake_attributions attribution
               where attribution.retain_until > now()
                 and attribution.captured_at >= now() - interval '14 days'
                 and attribution.captured_at < now() - interval '7 days'
             ) as previous_7_days_starts,
             (
               select count(*)::int
               from community_contributions contribution
               where contribution.retain_until > now()
                 and contribution.submitted_at >= now() - interval '14 days'
                 and contribution.submitted_at < now() - interval '7 days'
             ) as previous_7_days_completions,
             (
               select count(*)::int
               from community_intake_attributions attribution
               where attribution.retain_until > now()
                 and attribution.captured_at >= now() - interval '30 days'
             ) as last_30_days_starts,
             (
               select count(*)::int
               from community_contributions contribution
               where contribution.retain_until > now()
                 and contribution.submitted_at >= now() - interval '30 days'
             ) as last_30_days_completions,
             (
               select max(attribution.captured_at)::text
               from community_intake_attributions attribution
               where attribution.retain_until > now()
             ) as last_started_at,
             (
               select max(contribution.submitted_at)::text
               from community_contributions contribution
               where contribution.retain_until > now()
             ) as last_completed_at
    `,
    sql<{
      source: string;
      medium: string | null;
      campaign: string | null;
      content: string | null;
      starts: number;
      completions: number;
      last_started_at: string | null;
      last_completed_at: string | null;
    }[]>`
      with attribution_window as (
        select attribution.source, attribution.medium, attribution.campaign,
               attribution.content, attribution.captured_at
        from community_intake_attributions attribution
        where attribution.retain_until > now()
          and attribution.captured_at >= now() - interval '30 days'
      ),
      completion_window as (
        select coalesce(attribution.source, 'not-recorded') as source,
               attribution.medium, attribution.campaign, attribution.content,
               contribution.submitted_at
        from community_contributions contribution
        left join community_intake_attributions attribution
          on attribution.draft_id = contribution.draft_id
          and attribution.retain_until > now()
        where contribution.retain_until > now()
          and contribution.submitted_at >= now() - interval '30 days'
      ),
      campaign_counts as (
        select source, medium, campaign, content,
               count(*)::int as starts,
               0::int as completions,
               max(captured_at)::text as last_started_at,
               null::text as last_completed_at
        from attribution_window
        group by source, medium, campaign, content
        union all
        select source, medium, campaign, content,
               0::int as starts,
               count(*)::int as completions,
               null::text as last_started_at,
               max(submitted_at)::text as last_completed_at
        from completion_window
        group by source, medium, campaign, content
      )
      select source, medium, campaign, content,
             sum(starts)::int as starts,
             sum(completions)::int as completions,
             max(last_started_at) as last_started_at,
             max(last_completed_at) as last_completed_at
      from campaign_counts
      group by source, medium, campaign, content
      order by completions desc, starts desc,
               max(last_completed_at) desc nulls last,
               max(last_started_at) desc nulls last,
               source asc, medium asc nulls first,
               campaign asc nulls first, content asc nulls first
      limit 12
    `,
  ]);
  const summary = summaryRows[0];
  if (!summary) throw new Error('Contribution attribution summary unavailable.');

  return {
    asOf: summary.as_of,
    last7DaysStarts: summary.last_7_days_starts,
    last7DaysCompletions: summary.last_7_days_completions,
    previous7DaysStarts: summary.previous_7_days_starts,
    previous7DaysCompletions: summary.previous_7_days_completions,
    last30DaysStarts: summary.last_30_days_starts,
    last30DaysCompletions: summary.last_30_days_completions,
    lastStartedAt: summary.last_started_at,
    lastCompletedAt: summary.last_completed_at,
    campaigns: campaignRows.map(row => ({
      source: row.source,
      medium: row.medium,
      campaign: row.campaign,
      content: row.content,
      starts: row.starts,
      completions: row.completions,
      lastStartedAt: row.last_started_at,
      lastCompletedAt: row.last_completed_at,
    })),
  };
}
