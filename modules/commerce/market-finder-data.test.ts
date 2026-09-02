import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { PostgresClient } from "@/lib/db/postgres";
import {
  isMarketFinderPublicMarketAllowed,
  isMarketFinderPublicReadEnabled,
  isMarketFinderReportIntakeEnabled,
  marketFinderPublicMarketSlug,
  MARKET_FINDER_PUBLIC_MARKET_FLAG,
  MARKET_FINDER_PUBLIC_READ_FLAG,
} from "@/lib/markets/activation";
import {
  enforceMarketFinderFreshness,
  isMarketFinderSlug,
  normalizeMarketFinderPublicAction,
  type MarketFinderReadModel,
} from "@/lib/markets/domain";
import {
  readMarketFinder,
  readMarketFinderDirectory,
  resolveMarketReportTargetContext,
} from "@/lib/markets/repository";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

const enabledPublicReadEnvironment = {
  MARKET_FINDER_PUBLIC_READ_ENABLED: "true",
  MARKET_FINDER_PUBLIC_MARKET_SLUG: "trade-fair",
};

function queryText(strings: TemplateStringsArray): string {
  return strings
    .reduce(
      (text, part, index) => `${text}${index === 0 ? "" : " ? "}${part}`,
      "",
    )
    .replace(/\s+/gu, " ")
    .trim();
}

function directoryClient() {
  const state = { queries: [] as string[], values: [] as unknown[][] };
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = queryText(strings);
    state.queries.push(query);
    state.values.push(values);

    if (query.includes("from physical_markets market")) {
      return [
        {
          market_id: "00000000-0000-4000-8000-000000000001",
          market_slug: "trade-fair",
          market_name: "Lagos Trade Fair",
          city: "Lagos",
          state_region: "Lagos",
          country_code: "NG",
        },
      ];
    }
    if (
      query.includes("from physical_product_observations directory_observation")
    ) {
      return [
        {
          product_identity_version_id: "00000000-0000-4000-8000-000000000002",
          product_id: "00000000-0000-4000-8000-000000000003",
          product_slug: "exact-product",
          product_brand: "Brand",
          product_variant: "Exact product",
          product_size: "50 ml",
          package_version: "v1",
          formula_version: "v1",
        },
      ];
    }
    throw new Error(`Unexpected directory query: ${query}`);
  }) as unknown as PostgresClient;

  return { client, state };
}

function exactReadClientWithActionFallback() {
  const state = { queries: [] as string[] };
  const client = ((strings: TemplateStringsArray) => {
    const query = queryText(strings);
    state.queries.push(query);

    if (query.includes("from physical_markets market")) {
      return [
        {
          market_id: "00000000-0000-4000-8000-000000000001",
          market_slug: "trade-fair",
          market_name: "Lagos Trade Fair",
          city: "Lagos",
          state_region: "Lagos",
          country_code: "NG",
          product_identity_version_id: "00000000-0000-4000-8000-000000000002",
          product_id: "00000000-0000-4000-8000-000000000003",
          product_slug: "exact-product",
          product_brand: "Brand",
          product_variant: "Exact product",
          product_size: "50 ml",
          package_version: "v1",
          formula_version: "v1",
        },
      ];
    }
    if (query.includes("from retailer_locations location")) {
      const location = {
        location_id: "00000000-0000-4000-8000-000000000004",
        location_slug: "verified-shop",
        location_name: "Verified shop",
        retailer_name: "Verified retailer",
        place_name: "Akwa Ibom Plaza",
        shop_number: "A43",
        floor: null,
        location_expires_at: "2026-09-03T10:00:00.000Z",
        identity_evidence_expires_at: "2026-09-03T10:00:00.000Z",
        observation_id: "00000000-0000-4000-8000-000000000005",
        availability: "in_stock" as const,
        price_ngn: null,
        observed_at: "2026-09-01T09:00:00.000Z",
        observation_expires_at: "2026-09-02T10:00:00.000Z",
        source_method: "field_visit" as const,
        observed_title: "Exact product",
        observed_size: "50 ml",
        action_expires_at: "2026-09-02T10:00:00.000Z",
      };
      return [
        {
          ...location,
          action_kind: "whatsapp",
          action_destination: "javascript:alert(1)",
        },
        {
          ...location,
          action_kind: "phone",
          action_destination: "+234 800 000 0000",
        },
      ];
    }
    throw new Error(`Unexpected exact-read query: ${query}`);
  }) as unknown as PostgresClient;

  return { client, state };
}

const exactContextRow = {
  market_id: "00000000-0000-4000-8000-000000000001",
  market_slug: "trade-fair",
  market_name: "Lagos Trade Fair",
  city: "Lagos",
  state_region: "Lagos",
  country_code: "NG",
  product_identity_version_id: "00000000-0000-4000-8000-000000000002",
  product_id: "00000000-0000-4000-8000-000000000003",
  product_slug: "exact-product",
  product_brand: "Brand",
  product_variant: "Exact product",
  product_size: "50 ml",
  package_version: "v1",
  formula_version: "v1",
};

function researchLocationRow(input: {
  id: string;
  slug: string;
  availability:
    "in_stock" | "low_stock" | "out_of_stock" | "unknown" | "not_carried";
  observationExpiresAt: string;
  moderationStatus?: "pending" | "approved" | "rejected" | "superseded";
}) {
  return {
    location_id: input.id,
    location_slug: input.slug,
    location_name: `Reviewed ${input.slug}`,
    retailer_name: "Reviewed retailer",
    place_name: "Reviewed Plaza",
    shop_number: "A43",
    floor: null,
    location_expires_at: "2026-09-08T10:00:00.000Z",
    identity_evidence_expires_at: "2026-09-08T10:00:00.000Z",
    observation_id: `${input.id}-observation`,
    availability: input.availability,
    price_ngn: null,
    observed_at: "2026-09-01T09:00:00.000Z",
    observation_expires_at: input.observationExpiresAt,
    source_method: "field_visit" as const,
    observed_title: "Exact product",
    observed_size: "50 ml",
    observation_moderation_status: input.moderationStatus ?? "approved",
    // These values emulate accidental over-selection by a database adapter.
    // The public mapper must still omit them from every research record.
    action_destination: "https://wa.me/2348111111111",
    public_directions: "Private shortcut that must not be rendered",
  };
}

function mixedResearchClient() {
  const state = { queries: [] as string[] };
  const current = {
    ...researchLocationRow({
      id: "current-location",
      slug: "current-shop",
      availability: "in_stock",
      observationExpiresAt: "2026-09-02T10:00:00.000Z",
    }),
    action_kind: "phone" as const,
    action_destination: "+2348000000000",
    action_expires_at: "2026-09-02T10:00:00.000Z",
  };
  const research = [
    current,
    researchLocationRow({
      id: "stale-location",
      slug: "stale-shop",
      availability: "in_stock",
      observationExpiresAt: "2026-09-01T10:00:00.000Z",
    }),
    researchLocationRow({
      id: "out-location",
      slug: "out-shop",
      availability: "out_of_stock",
      observationExpiresAt: "2026-09-02T10:00:00.000Z",
    }),
    researchLocationRow({
      id: "not-carried-location",
      slug: "not-carried-shop",
      availability: "not_carried",
      observationExpiresAt: "2026-09-02T10:00:00.000Z",
    }),
    researchLocationRow({
      id: "unknown-location",
      slug: "unknown-shop",
      availability: "unknown",
      observationExpiresAt: "2026-09-02T10:00:00.000Z",
    }),
    researchLocationRow({
      id: "no-action-location",
      slug: "no-action-shop",
      availability: "low_stock",
      observationExpiresAt: "2026-09-02T10:00:00.000Z",
    }),
    researchLocationRow({
      id: "pending-location",
      slug: "pending-shop",
      availability: "in_stock",
      observationExpiresAt: "2026-09-02T10:00:00.000Z",
      moderationStatus: "pending",
    }),
  ];

  const client = ((strings: TemplateStringsArray) => {
    const query = queryText(strings);
    state.queries.push(query);
    if (query.includes("count(observation.id)::integer")) {
      return [
        {
          approved_observation_count: research.length,
          has_disputed: true,
          has_location_needs_recheck: true,
          has_stale: true,
          has_stock_unavailable: true,
          has_no_usable_action: true,
        },
      ];
    }
    if (query.includes("action.action_kind")) return [current];
    if (query.includes("from retailer_locations location")) return research;
    if (query.includes("from physical_markets market")) {
      return [exactContextRow];
    }
    throw new Error(`Unexpected mixed-read query: ${query}`);
  }) as unknown as PostgresClient;

  return { client, state };
}

function reportTargetRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    ...exactContextRow,
    retailer_location_id: "00000000-0000-4000-8000-000000000004",
    location_slug: "verified-shop",
    location_name: "Verified shop",
    location_state: "verified",
    location_expires_at: "2026-09-03T10:00:00.000Z",
    place_state: "verified",
    identity_evidence_expires_at: "2026-09-03T10:00:00.000Z",
    observation_moderation_status: "approved",
    observation_availability: "in_stock",
    observation_expires_at: "2026-09-02T10:00:00.000Z",
    action_kind: "phone",
    action_destination: "+2348000000000",
    action_expires_at: "2026-09-02T10:00:00.000Z",
    ...overrides,
  };
}

function reportTargetClient(rows: Record<string, unknown>[]) {
  const state = { queries: [] as string[] };
  const client = ((strings: TemplateStringsArray) => {
    state.queries.push(queryText(strings));
    return rows;
  }) as unknown as PostgresClient;
  return { client, state };
}

test("0053 defines exactly the seven accepted additive tables without seed rows", async () => {
  const migration = await source(
    "db/migrations/0053_physical_market_finder.sql",
  );
  const tableNames = [...migration.matchAll(/create table ([a-z_]+) \(/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(tableNames, [
    "physical_markets",
    "physical_market_places",
    "retailer_locations",
    "retailer_location_channels",
    "retailer_location_evidence",
    "physical_product_observations",
    "market_finder_reports",
  ]);
  assert.equal(tableNames.length, 7);
  assert.doesNotMatch(migration, /insert\s+into/i);
  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.match(
    migration,
    /alter type community_contribution_kind add value 'market_report'/,
  );
});

test("0053 preserves exact identity, same-market hierarchy, and immutable evidence history", async () => {
  const migration = await source(
    "db/migrations/0053_physical_market_finder.sql",
  );

  assert.match(
    migration,
    /references catalogue_product_identity_versions\(identity_version_id\) on delete restrict/g,
  );
  assert.match(
    migration,
    /Physical market place parents must belong to the same market/,
  );
  assert.match(
    migration,
    /Physical market place hierarchy cycles are prohibited/,
  );
  assert.match(
    migration,
    /Retailer location and primary place must belong to the same market/,
  );
  assert.match(migration, /Retailer location evidence is append-only/);
  assert.match(migration, /Physical product observations are append-only/);
  assert.match(
    migration,
    /Market Finder report context and outcome are immutable/,
  );
  assert.match(
    migration,
    /contribution_id uuid primary key[\s\S]*references community_contributions\(id\) on delete cascade/,
  );
  assert.match(
    migration,
    /A direct Market Finder report rejection requires reviewer attribution/,
  );
  assert.match(
    migration,
    /A new Market Finder report projection must enter pending review/,
  );
  assert.match(
    migration,
    /New retailer location evidence must enter pending review/,
  );
  assert.match(
    migration,
    /New physical product observations must enter pending review/,
  );
  assert.doesNotMatch(
    migration.match(
      /create table market_finder_reports \([\s\S]*?\n\);/,
    )?.[0] ?? "",
    /retain_until/,
  );
  assert.match(
    migration,
    /community_contributions_market_report_rejection_trigger/,
  );
});

test("0053 makes publication, source freshness, audit, and runtime authority fail closed", async () => {
  const migration = await source(
    "db/migrations/0053_physical_market_finder.sql",
  );

  assert.match(migration, /publication_state market_publication_state/);
  assert.match(
    migration,
    /A verified location requires approved attributable identity evidence/,
  );
  assert.match(
    migration,
    /Discovery-only sources cannot approve physical shelf availability/,
  );
  assert.match(migration, /when 'field_visit' then interval '14 days'/);
  assert.match(
    migration,
    /when 'retailer_confirmation' then interval '7 days'/,
  );
  assert.match(migration, /when 'branch_online_record' then interval '3 days'/);
  assert.match(migration, /when 'community_report' then interval '3 days'/);
  assert.match(migration, /'market_finder_report'/);
  assert.match(migration, /'retailer_location'/);
  assert.match(migration, /'physical_product_observation'/);
  assert.match(
    migration,
    /grant update \(moderation_status, reviewed_by, reviewed_at\)[\s\S]*physical_product_observations, market_finder_reports/,
  );
  assert.match(
    migration,
    /revoke delete on table[\s\S]*physical_product_observations[\s\S]*from jelocare_app_runtime/,
  );
});

test("0054 makes report intake share the current public-result boundary", async () => {
  const migration = await source(
    "db/migrations/0054_market_finder_report_current_context.sql",
  );

  assert.match(migration, /^begin;/);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /insert\s+into/i);
  assert.match(
    migration,
    /create function public\.market_finder_public_action_is_usable/,
  );
  assert.equal(
    migration.match(/set search_path = pg_catalog, public, pg_temp/g)?.length,
    2,
  );
  assert.match(
    migration,
    /from public\.community_contributions[\s\S]*for no key update/,
  );
  assert.match(
    migration,
    /approved_observation\.moderation_status = 'approved'[\s\S]*not exists \([\s\S]*approved_successor\.supersedes_observation_id = approved_observation\.id[\s\S]*approved_successor\.moderation_status = 'approved'/,
  );
  assert.match(
    migration,
    /approved_observation\.observed_at desc,[\s\S]*approved_observation\.created_at desc,[\s\S]*approved_observation\.id desc/,
  );
  assert.match(
    migration,
    /observation\.expires_at > statement_timestamp\(\)[\s\S]*observation\.availability in \('in_stock', 'low_stock'\)/,
  );
  assert.match(
    migration,
    /directions_evidence\.evidence_scope = 'public_directions'[\s\S]*directions_evidence\.decision = 'approved'[\s\S]*directions_evidence\.expires_at > statement_timestamp\(\)/,
  );
  assert.match(
    migration,
    /channel\.channel_state = 'verified'[\s\S]*channel\.expires_at > statement_timestamp\(\)[\s\S]*public\.market_finder_public_action_is_usable/,
  );
  assert.match(
    migration,
    /Market Finder report context requires a current eligible exact-product result/,
  );
  assert.match(migration, /\(\?:\^\|\\\.\)xn--/);
  assert.match(migration, /char_length\(url_port\) > 5/);
});

test("public reads require the exact kill switch and Trade Fair pilot allowlist", () => {
  assert.equal(
    MARKET_FINDER_PUBLIC_READ_FLAG,
    "MARKET_FINDER_PUBLIC_READ_ENABLED",
  );
  assert.equal(
    MARKET_FINDER_PUBLIC_MARKET_FLAG,
    "MARKET_FINDER_PUBLIC_MARKET_SLUG",
  );
  assert.equal(isMarketFinderPublicReadEnabled({}), false);
  assert.equal(
    isMarketFinderPublicReadEnabled({
      MARKET_FINDER_PUBLIC_READ_ENABLED: "true",
    }),
    false,
  );
  assert.equal(
    isMarketFinderPublicReadEnabled(enabledPublicReadEnvironment),
    true,
  );
  assert.equal(
    marketFinderPublicMarketSlug({
      MARKET_FINDER_PUBLIC_READ_ENABLED: "true",
      MARKET_FINDER_PUBLIC_MARKET_SLUG: "balogun",
    }),
    null,
  );
  assert.equal(
    isMarketFinderPublicMarketAllowed(
      "trade-fair",
      enabledPublicReadEnvironment,
    ),
    true,
  );
  assert.equal(
    isMarketFinderPublicMarketAllowed("balogun", enabledPublicReadEnvironment),
    false,
  );
  assert.equal(
    isMarketFinderReportIntakeEnabled({
      MARKET_FINDER_REPORT_INTAKE_ENABLED: "true",
    }),
    false,
  );
  assert.equal(
    isMarketFinderReportIntakeEnabled({
      ...enabledPublicReadEnvironment,
      MARKET_FINDER_REPORT_INTAKE_ENABLED: "true",
    }),
    true,
  );
});

test("directory discovery is gated before IO and admits observation-backed identities", async () => {
  const fixture = directoryClient();
  const now = new Date("2026-09-01T10:00:00.000Z");

  const disabled = await readMarketFinderDirectory("trade-fair", {
    client: fixture.client,
    environment: {},
    now,
  });
  assert.equal(disabled.state, "empty");
  assert.equal(
    disabled.state === "empty" ? disabled.reason : null,
    "public-read-disabled",
  );
  assert.equal(fixture.state.queries.length, 0);

  const outsidePilot = await readMarketFinderDirectory("balogun", {
    client: fixture.client,
    environment: enabledPublicReadEnvironment,
    now,
  });
  assert.equal(outsidePilot.state, "empty");
  assert.equal(fixture.state.queries.length, 0);

  const directory = await readMarketFinderDirectory("trade-fair", {
    client: fixture.client,
    environment: enabledPublicReadEnvironment,
    now,
  });
  assert.equal(directory.state, "current");
  assert.equal(directory.market?.slug, "trade-fair");
  assert.deepEqual(
    directory.products.map((product) => product.slug),
    ["exact-product"],
  );
  assert.equal(fixture.state.queries.length, 2);
  assert.match(
    fixture.state.queries[1] ?? "",
    /directory_observation\.moderation_status = 'approved'/,
  );
  assert.match(
    fixture.state.queries[1] ?? "",
    /identity_version\.lifecycle_state = 'active'/,
  );
  assert.match(fixture.state.queries[1] ?? "", /product\.is_published = true/);
});

test("disabled public reads close exact results and report context before IO", async () => {
  const fixture = directoryClient();
  const options = {
    client: fixture.client,
    environment: {},
    now: new Date("2026-09-01T10:00:00.000Z"),
  };

  const result = await readMarketFinder(
    { marketSlug: "trade-fair", productSlug: "exact-product" },
    options,
  );
  assert.equal(result.state, "empty");
  assert.equal(
    result.state === "empty" ? result.reason : null,
    "public-read-disabled",
  );

  const reportContext = await resolveMarketReportTargetContext(
    {
      marketSlug: "trade-fair",
      locationSlug: "verified-shop",
      productSlug: "exact-product",
    },
    options,
  );
  assert.deepEqual(reportContext, {
    status: "unresolved",
    reason: "unknown-context",
  });
  assert.equal(fixture.state.queries.length, 0);
});

test("exact reads fall back from an unsafe preferred action to the next safe action", async () => {
  const fixture = exactReadClientWithActionFallback();
  const result = await readMarketFinder(
    { marketSlug: "trade-fair", productSlug: "exact-product" },
    {
      client: fixture.client,
      environment: enabledPublicReadEnvironment,
      now: new Date("2026-09-01T10:00:00.000Z"),
    },
  );

  assert.equal(result.state, "current");
  assert.equal(result.locations.length, 1);
  assert.deepEqual(result.locations[0]?.action, {
    kind: "phone",
    destination: "+2348000000000",
    href: "tel:+2348000000000",
    expiresAt: "2026-09-02T10:00:00.000Z",
  });
  assert.equal(fixture.state.queries.length, 4);

  const repository = await source("lib/markets/repository.ts");
  const actionCandidates =
    repository.match(
      /join lateral \(\s*select candidate\.\*[\s\S]*?\) action on true/,
    )?.[0] ?? "";
  assert.doesNotMatch(actionCandidates, /limit 1/);
  assert.match(repository, /action\.preference/);
});

test("exact reads keep safe reviewed history beside current results without action data", async () => {
  const fixture = mixedResearchClient();
  const result = await readMarketFinder(
    { marketSlug: "trade-fair", productSlug: "exact-product" },
    {
      client: fixture.client,
      environment: enabledPublicReadEnvironment,
      now: new Date("2026-09-01T10:00:00.000Z"),
    },
  );

  assert.equal(result.state, "current");
  assert.deepEqual(
    result.locations.map((location) => location.slug),
    ["current-shop"],
  );
  assert.deepEqual(
    result.researchRecords.map((record) => record.reason),
    [
      "evidence-expired",
      "stock-unavailable",
      "stock-unavailable",
      "stock-unavailable",
      "no-usable-action",
      "location-needs-recheck",
      "location-disputed",
    ],
  );
  assert.equal(
    result.researchRecords.some((record) => record.id === "pending-location"),
    false,
  );
  const serialized = JSON.stringify(result.researchRecords);
  assert.doesNotMatch(
    serialized,
    /wa\.me|Private shortcut|action_destination|public_directions|href|priceNgn/i,
  );

  const unavailable = result.researchRecords.flatMap((record) =>
    record.kind === "location" && record.reason === "stock-unavailable"
      ? [record.observation.availability]
      : [],
  );
  assert.deepEqual(unavailable, ["out_of_stock", "not_carried", "unknown"]);
  const warning = result.researchRecords.at(-1);
  assert.deepEqual(warning, {
    kind: "warning",
    id: "location-disputed",
    reason: "location-disputed",
  });
  assert.deepEqual(result.researchRecords.at(-2), {
    kind: "warning",
    id: "location-needs-recheck",
    reason: "location-needs-recheck",
  });

  const researchQuery = fixture.state.queries.find(
    (query) =>
      query.includes(
        "observation.moderation_status as observation_moderation_status",
      ) && !query.includes("action.action_kind"),
  );
  assert.ok(researchQuery);
  assert.match(researchQuery, /location\.location_state = 'verified'/);
  assert.match(researchQuery, /location\.verification_expires_at > \?/);
  assert.match(researchQuery, /identity_candidate\.decision = 'approved'/);
  assert.match(researchQuery, /identity_evidence\.expires_at > \?/);
  assert.match(researchQuery, /place\.place_state = 'verified'/);
  assert.match(
    researchQuery,
    /approved_observation\.moderation_status = 'approved'/,
  );
  assert.match(researchQuery, /approved_successor\.supersedes_observation_id/);
  assert.doesNotMatch(
    researchQuery,
    /public_directions|public_destination|price_ngn/,
  );
  const diagnosticQuery = fixture.state.queries.find((query) =>
    query.includes("count(observation.id)::integer"),
  );
  assert.ok(diagnosticQuery);
  assert.match(diagnosticQuery, /has_location_needs_recheck/);
  assert.match(
    diagnosticQuery,
    /place\.place_state is distinct from 'verified'/,
  );
});

test("report targets resolve only for a current exact result with a safe action", async () => {
  const now = new Date("2026-09-01T10:00:00.000Z");
  const current = reportTargetClient([
    reportTargetRow({
      action_kind: "website",
      action_destination: "javascript:alert(1)",
    }),
    reportTargetRow(),
  ]);
  const resolved = await resolveMarketReportTargetContext(
    {
      marketSlug: "trade-fair",
      locationSlug: "verified-shop",
      productSlug: "exact-product",
    },
    {
      client: current.client,
      environment: enabledPublicReadEnvironment,
      now,
    },
  );
  assert.equal(resolved.status, "resolved");

  const rejectedCases = [
    reportTargetRow({
      observation_expires_at: "2026-09-01T10:00:00.000Z",
    }),
    reportTargetRow({ observation_availability: "out_of_stock" }),
    reportTargetRow({ location_state: "disputed" }),
    reportTargetRow({ place_state: "disputed" }),
    reportTargetRow({
      identity_evidence_expires_at: "2026-09-01T10:00:00.000Z",
    }),
    reportTargetRow({
      action_kind: "website",
      action_destination: "javascript:alert(1)",
    }),
    reportTargetRow({
      action_expires_at: "2026-09-01T10:00:00.000Z",
    }),
    reportTargetRow({ observation_moderation_status: "pending" }),
  ];
  for (const candidate of rejectedCases) {
    const fixture = reportTargetClient([candidate]);
    const resolution = await resolveMarketReportTargetContext(
      {
        marketSlug: "trade-fair",
        locationSlug: "verified-shop",
        productSlug: "exact-product",
      },
      {
        client: fixture.client,
        environment: enabledPublicReadEnvironment,
        now,
      },
    );
    assert.deepEqual(resolution, {
      status: "unresolved",
      reason: "unknown-context",
    });
  }

  const reportQuery = current.state.queries[0] ?? "";
  assert.match(reportQuery, /observation\.expires_at > \?/);
  assert.match(
    reportQuery,
    /observation\.availability in \('in_stock', 'low_stock'\)/,
  );
  assert.match(reportQuery, /identity_evidence\.expires_at > \?/);
  assert.match(reportQuery, /candidate\.action_expires_at > \?/);
  assert.match(reportQuery, /approved_successor\.supersedes_observation_id/);
});

test("public actions keep directions as text and expose only bounded safe links", () => {
  assert.deepEqual(
    normalizeMarketFinderPublicAction({
      kind: "directions",
      destination: "  Walk past the first plaza.\nTurn left.  ",
    }),
    {
      kind: "directions",
      destination: "Walk past the first plaza. Turn left.",
      href: null,
    },
  );
  assert.deepEqual(
    normalizeMarketFinderPublicAction({
      kind: "directions",
      destination: "javascript:alert(1)",
    }),
    {
      kind: "directions",
      destination: "javascript:alert(1)",
      href: null,
    },
  );
  assert.deepEqual(
    normalizeMarketFinderPublicAction({
      kind: "directions",
      destination: "🧴".repeat(300),
    }),
    {
      kind: "directions",
      destination: "🧴".repeat(300),
      href: null,
    },
  );
  assert.equal(
    normalizeMarketFinderPublicAction({
      kind: "directions",
      destination: "🧴".repeat(501),
    }),
    null,
  );
  for (const destination of ["\t\n\r", "\u00a0\ufeff"]) {
    assert.equal(
      normalizeMarketFinderPublicAction({ kind: "directions", destination }),
      null,
    );
  }
  assert.equal(
    normalizeMarketFinderPublicAction({
      kind: "website",
      destination: "javascript:alert(1)",
    }),
    null,
  );
  assert.equal(
    normalizeMarketFinderPublicAction({
      kind: "website",
      destination: "http://example.com",
    }),
    null,
  );
  assert.equal(
    normalizeMarketFinderPublicAction({
      kind: "website",
      destination: "https://localhost/unsafe",
    }),
    null,
  );
  for (const destination of [
    "https://localhost./unsafe",
    "https://example.local./unsafe",
    "https://127.0.0.1/unsafe",
    "https://2130706433/unsafe",
    "https://0x7f000001/unsafe",
    "https://017700000001/unsafe",
    "https://127.1/unsafe",
    "https://0x7f.0.0.1/unsafe",
    "https://0x/unsafe",
    "https://example.123/unsafe",
    "https://foo.00/unsafe",
    "https://foo.0x/unsafe",
    "https://xn--/unsafe",
    "https://xn--a/unsafe",
    "https://xn--abc/unsafe",
  ]) {
    assert.equal(
      normalizeMarketFinderPublicAction({ kind: "website", destination }),
      null,
      destination,
    );
  }
  assert.deepEqual(
    normalizeMarketFinderPublicAction({
      kind: "phone",
      destination: "+234 (800) 000-0000",
    }),
    {
      kind: "phone",
      destination: "+2348000000000",
      href: "tel:+2348000000000",
    },
  );
  assert.equal(
    normalizeMarketFinderPublicAction({
      kind: "whatsapp",
      destination: "https://example.com/send",
    }),
    null,
  );
  assert.deepEqual(
    normalizeMarketFinderPublicAction({
      kind: "whatsapp",
      destination: "https://wa.me/2348000000000",
    }),
    {
      kind: "whatsapp",
      destination: "https://wa.me/2348000000000",
      href: "https://wa.me/2348000000000",
    },
  );
});

test("the database read model requires every public-actionability gate and no fallback domain", async () => {
  const repository = await source("lib/markets/repository.ts");

  assert.match(repository, /market\.publication_state = 'published'/);
  assert.match(repository, /identity_version\.lifecycle_state = 'active'/);
  assert.match(repository, /product\.is_published = true/);
  assert.match(repository, /location\.location_state = 'verified'/);
  assert.match(repository, /location\.verification_expires_at > \$\{now\}/);
  assert.match(repository, /observation\.moderation_status = 'approved'/);
  assert.match(repository, /observation\.expires_at > \$\{now\}/);
  assert.match(
    repository,
    /observation\.availability in \('in_stock', 'low_stock'\)/,
  );
  assert.match(repository, /channel\.channel_state = 'verified'/);
  assert.match(repository, /channel_evidence\.decision = 'approved'/);
  assert.match(repository, /identity_evidence\.decision = 'approved'/);
  assert.match(
    repository,
    /from physical_product_observations supported_observation/,
  );
  assert.match(repository, /normalizeMarketFinderPublicAction\(/);
  assert.match(repository, /public\.market_finder_public_action_is_usable\(/);
  assert.match(
    repository,
    /approved_observation\.created_at desc,\s*approved_observation\.id desc/,
  );
  assert.match(repository, /There is intentionally no fixture, static-file/);
  assert.doesNotMatch(
    repository,
    /MARKET_FIXTURE|from offers|community_observations/,
  );
});

test("cached current rows become redacted research after evidence expiry", () => {
  const model: MarketFinderReadModel = {
    state: "current",
    evaluatedAt: "2026-09-01T10:00:00.000Z",
    context: {
      market: {
        id: "00000000-0000-4000-8000-000000000001",
        slug: "trade-fair",
        name: "Trade Fair",
        city: "Lagos",
        stateRegion: "Lagos",
        countryCode: "NG",
      },
      product: {
        identityVersionId: "00000000-0000-4000-8000-000000000002",
        productId: "00000000-0000-4000-8000-000000000003",
        slug: "exact-product",
        brand: "Brand",
        variant: "Exact product",
        size: "50 ml",
        packageVersion: "v1",
        formulaVersion: "v1",
      },
    },
    locations: [
      {
        id: "00000000-0000-4000-8000-000000000004",
        slug: "verified-shop",
        name: "Verified shop",
        retailerName: "Verified retailer",
        placeName: null,
        shopNumber: null,
        floor: null,
        locationVerificationExpiresAt: "2026-09-03T10:00:00.000Z",
        locationIdentityEvidenceExpiresAt: "2026-09-01T10:45:00.000Z",
        observation: {
          id: "00000000-0000-4000-8000-000000000005",
          availability: "in_stock",
          priceNgn: null,
          observedAt: "2026-09-01T09:00:00.000Z",
          expiresAt: "2026-09-01T11:00:00.000Z",
          sourceMethod: "field_visit",
          observedTitle: "Exact product",
          observedSize: "50 ml",
        },
        action: {
          kind: "whatsapp",
          destination: "https://wa.me/2348000000000",
          href: "https://wa.me/2348000000000",
          expiresAt: "2026-09-03T10:00:00.000Z",
        },
      },
    ],
    researchRecords: [],
  };

  assert.equal(
    enforceMarketFinderFreshness(model, new Date("2026-09-01T10:30:00.000Z"))
      .state,
    "current",
  );
  const stale = enforceMarketFinderFreshness(
    model,
    new Date("2026-09-01T10:45:00.000Z"),
  );
  assert.equal(stale.state, "stale");
  assert.deepEqual(stale.locations, []);
  assert.equal(
    stale.state === "stale" ? stale.reason : null,
    "evidence-expired",
  );
  assert.deepEqual(stale.researchRecords, [
    {
      kind: "warning",
      id: "location-recheck:00000000-0000-4000-8000-000000000004",
      reason: "location-needs-recheck",
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(stale.researchRecords),
    /Verified shop|wa\.me|action_destination|public_directions|href/i,
  );

  const actionExpiryModel: MarketFinderReadModel = {
    ...model,
    locations: model.locations.map((location) => ({
      ...location,
      locationIdentityEvidenceExpiresAt: "2026-09-03T10:00:00.000Z",
      action: {
        ...location.action,
        expiresAt: "2026-09-01T10:40:00.000Z",
      },
    })),
  };
  const actionExpired = enforceMarketFinderFreshness(
    actionExpiryModel,
    new Date("2026-09-01T10:40:00.000Z"),
  );
  assert.equal(actionExpired.state, "unavailable");
  assert.equal(
    actionExpired.state === "unavailable" ? actionExpired.reason : null,
    "no-usable-action",
  );
  assert.equal(actionExpired.researchRecords[0]?.kind, "location");
  assert.equal(actionExpired.researchRecords[0]?.reason, "no-usable-action");
  assert.doesNotMatch(
    JSON.stringify(actionExpired.researchRecords),
    /wa\.me|action_destination|public_directions|href/i,
  );
});

test("Market Finder slugs and cache invalidation remain bounded and targeted", async () => {
  const cache = await source("lib/markets/cache.ts");

  assert.equal(isMarketFinderSlug("trade-fair"), true);
  assert.equal(isMarketFinderSlug("Trade Fair"), false);
  assert.equal(isMarketFinderSlug("../trade-fair"), false);
  assert.match(cache, /MARKET_FINDER_CACHE_TAG}:market:/);
  assert.match(cache, /MARKET_FINDER_CACHE_TAG}:product:/);
  assert.match(cache, /MARKET_FINDER_CACHE_TAG}:location:/);
  assert.match(
    cache,
    /marketFinderDirectoryCacheTags[\s\S]*marketFinderMarketCacheTag\(marketSlug\)/,
  );
  const repository = await source("lib/markets/repository.ts");
  assert.match(
    repository,
    /tags: marketFinderDirectoryCacheTags\(marketSlug\)/,
  );
  assert.match(
    repository,
    /tags: marketFinderReadCacheTags\(\{ marketSlug, productSlug \}\)/,
  );
  assert.match(
    cache,
    /marketFinderReadCacheTags[\s\S]*marketFinderMarketCacheTag\(input\.marketSlug\)/,
  );
  assert.match(cache, /revalidateTag\(tag, \{ expire: 0 \}\)/);
  assert.doesNotMatch(cache, /revalidatePath/);
});
