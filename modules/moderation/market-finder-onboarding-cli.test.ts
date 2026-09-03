import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { Sql } from "postgres";
import {
  parseMarketFinderOnboardingCommand,
  parseMarketFinderOnboardingManifest,
  resolveMarketFinderOnboardingAdmin,
  runMarketFinderOnboarding,
  type MarketFinderOnboardingManifest,
} from "@/scripts/onboard-market-finder-pilot";

const now = new Date("2026-09-01T13:00:00.000Z");
const operatorSubject = "neon-auth|market-admin";

function onboardingManifest(): MarketFinderOnboardingManifest {
  return parseMarketFinderOnboardingManifest(
    {
      manifestVersion: 1,
      reviewedAt: "2026-09-01T12:00:00.000Z",
      rationale:
        "Approve one evidence-bound pilot location for the canonical market.",
      retailer: {
        id: "11111111-1111-4111-8111-111111111111",
        slug: "canonical-retailer",
      },
      product: {
        identityVersionId: "33333333-3333-4333-8333-333333333333",
        productId: "22222222-2222-4222-8222-222222222222",
        slug: "published-product",
      },
      market: {
        id: "44444444-4444-4444-8444-444444444444",
        slug: "mainland-beauty-market",
        publicName: "Mainland Beauty Market",
        city: "Lagos",
        stateRegion: "Lagos",
        countryCode: "NG",
      },
      place: {
        id: "55555555-5555-4555-8555-555555555555",
        slug: "north-gate",
        kind: "entrance",
        publicName: "North Gate",
        reviewedAliases: ["Civic Centre Gate"],
        parentPlaceId: null,
      },
      location: {
        id: "66666666-6666-4666-8666-666666666666",
        slug: "retailer-north-gate",
        publicName: "Retailer North Gate",
        shopNumber: "A12",
        floor: "Ground floor",
        verificationExpiresAt: "2027-02-15T12:00:00.000Z",
        identityEvidence: {
          id: "77777777-7777-4777-8777-777777777777",
          sourceMethod: "field_visit",
          sourceReference: "private-ledger:location:001",
          observedAt: "2026-08-31T12:00:00.000Z",
          expiresAt: "2027-02-20T12:00:00.000Z",
        },
        publicDirections: {
          text: "From North Gate, turn left at the civic centre.",
          evidence: {
            id: "88888888-8888-4888-8888-888888888888",
            sourceMethod: "field_visit",
            sourceReference: "private-ledger:directions:001",
            observedAt: "2026-08-31T12:00:00.000Z",
            expiresAt: "2027-02-20T12:00:00.000Z",
          },
        },
        channel: {
          id: "99999999-9999-4999-8999-999999999999",
          kind: "whatsapp",
          publicDestination: "https://wa.me/2348000000000",
          expiresAt: "2026-11-15T12:00:00.000Z",
          ownershipEvidence: {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            sourceMethod: "retailer_confirmation",
            sourceReference: "private-ledger:channel:001",
            observedAt: "2026-08-31T12:00:00.000Z",
            expiresAt: "2026-11-20T12:00:00.000Z",
          },
        },
      },
      initialObservation: {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        availability: "in_stock",
        priceNgn: 12500,
        observedAt: "2026-08-31T12:00:00.000Z",
        expiresAt: "2026-09-10T12:00:00.000Z",
        sourceMethod: "field_visit",
        sourceReference: "private-ledger:observation:001",
        observedTitle: "Published Product",
        observedSize: "50 ml",
      },
    },
    now,
  );
}

function locationOnlyOnboardingManifest(): MarketFinderOnboardingManifest {
  const manifest = onboardingManifest();
  delete manifest.product;
  delete manifest.initialObservation;
  return parseMarketFinderOnboardingManifest(manifest, now);
}

function queryText(strings: TemplateStringsArray) {
  return strings
    .reduce(
      (text, part, index) => `${text}${index === 0 ? "" : " ? "}${part}`,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

type MarketRow = {
  id: string;
  slug: string;
  public_name: string;
  city: string;
  state_region: string;
  country_code: string;
  publication_state: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type PlaceRow = {
  id: string;
  market_id: string;
  parent_place_id: string | null;
  slug: string;
  place_kind: string;
  public_name: string;
  reviewed_aliases: string[];
  place_state: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type LocationRow = {
  id: string;
  retailer_id: string;
  market_id: string;
  primary_place_id: string | null;
  slug: string;
  public_name: string;
  shop_number: string | null;
  floor: string | null;
  public_directions: string | null;
  location_state: string;
  verified_at: string | null;
  verification_expires_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type EvidenceRow = {
  id: string;
  retailer_location_id: string;
  channel_id: string | null;
  evidence_scope: string;
  source_method: string;
  source_reference: string;
  observed_at: string;
  expires_at: string;
  decision: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type ChannelRow = {
  id: string;
  retailer_location_id: string;
  channel_kind: string;
  public_destination: string;
  channel_state: string;
  source_method: string;
  source_reference: string;
  verified_at: string | null;
  expires_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

type ObservationRow = {
  id: string;
  retailer_location_id: string;
  product_identity_version_id: string;
  availability: string;
  price_ngn: number | null;
  observed_at: string;
  expires_at: string;
  source_method: string;
  source_reference: string;
  observed_title: string;
  observed_size: string;
  moderation_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

function onboardingFixture(
  input: {
    operatorRole?: string;
    conflictingRetailer?: boolean;
    manifest?: MarketFinderOnboardingManifest;
  } = {},
) {
  const manifest = input.manifest ?? onboardingManifest();
  const state = {
    market: null as MarketRow | null,
    place: null as PlaceRow | null,
    location: null as LocationRow | null,
    evidence: new Map<string, EvidenceRow>(),
    channel: null as ChannelRow | null,
    observation: null as ObservationRow | null,
    transactionModes: [] as string[],
    events: [] as string[],
    queries: [] as string[],
    auditCount: 0,
    auditMetadata: [] as unknown[],
  };

  const tag = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = queryText(strings);
    state.queries.push(query);

    if (query.includes("from moderation_operators")) {
      if (input.operatorRole === "inactive") return [];
      return [
        { auth_subject: operatorSubject, role: input.operatorRole ?? "admin" },
      ];
    }
    if (query.includes("from retailers")) {
      if (input.conflictingRetailer) {
        return [{ id: manifest.retailer.id, slug: "different-retailer" }];
      }
      return [manifest.retailer];
    }
    if (query.includes("from catalogue_product_identity_versions")) {
      assert.ok(manifest.product);
      return [
        {
          identity_version_id: manifest.product.identityVersionId,
          product_id: manifest.product.productId,
          lifecycle_state: "active",
          product_slug: manifest.product.slug,
          is_published: true,
        },
      ];
    }
    if (query.includes("from physical_product_observations")) {
      return state.observation ? [state.observation] : [];
    }
    if (query.includes("from retailer_location_evidence")) {
      const row = state.evidence.get(String(values[0]));
      return row ? [row] : [];
    }
    if (query.includes("from retailer_location_channels")) {
      return state.channel ? [state.channel] : [];
    }
    if (query.includes("from retailer_locations")) {
      return state.location ? [state.location] : [];
    }
    if (query.includes("from physical_market_places")) {
      return state.place ? [state.place] : [];
    }
    if (query.includes("from physical_markets")) {
      return state.market ? [state.market] : [];
    }

    if (query.startsWith("insert into physical_markets")) {
      state.market = {
        id: String(values[0]),
        slug: String(values[1]),
        public_name: String(values[2]),
        city: String(values[3]),
        state_region: String(values[4]),
        country_code: String(values[5]),
        publication_state: "draft",
        reviewed_by: null,
        reviewed_at: null,
      };
      state.events.push("insert:market:draft");
      return [{ id: manifest.market.id }];
    }
    if (query.startsWith("update physical_markets")) {
      assert.ok(state.market);
      state.market.publication_state = "published";
      state.market.reviewed_by = String(values[0]);
      state.market.reviewed_at = String(values[1]);
      state.events.push("update:market:published");
      return [{ id: manifest.market.id }];
    }
    if (query.startsWith("insert into physical_market_places")) {
      state.place = {
        id: String(values[0]),
        market_id: String(values[1]),
        parent_place_id: values[2] === null ? null : String(values[2]),
        slug: String(values[3]),
        place_kind: String(values[4]),
        public_name: String(values[5]),
        reviewed_aliases: values[6] as string[],
        place_state: "lead",
        reviewed_by: null,
        reviewed_at: null,
      };
      state.events.push("insert:place:lead");
      return [{ id: manifest.place?.id ?? "" }];
    }
    if (query.startsWith("update physical_market_places")) {
      assert.ok(state.place);
      state.place.place_state = "verified";
      state.place.reviewed_by = String(values[0]);
      state.place.reviewed_at = String(values[1]);
      state.events.push("update:place:verified");
      return [{ id: manifest.place?.id ?? "" }];
    }
    if (query.startsWith("insert into retailer_locations")) {
      state.location = {
        id: String(values[0]),
        retailer_id: String(values[1]),
        market_id: String(values[2]),
        primary_place_id: values[3] === null ? null : String(values[3]),
        slug: String(values[4]),
        public_name: String(values[5]),
        shop_number: values[6] === null ? null : String(values[6]),
        floor: values[7] === null ? null : String(values[7]),
        public_directions: values[8] === null ? null : String(values[8]),
        location_state: "lead",
        verified_at: null,
        verification_expires_at: null,
        reviewed_by: null,
        reviewed_at: null,
      };
      state.events.push("insert:location:lead");
      return [{ id: manifest.location.id }];
    }
    if (query.startsWith("update retailer_locations")) {
      assert.ok(state.location);
      state.location.location_state = "verified";
      state.location.verified_at = String(values[0]);
      state.location.verification_expires_at = String(values[1]);
      state.location.reviewed_by = String(values[2]);
      state.location.reviewed_at = String(values[3]);
      state.events.push("update:location:verified");
      return [{ id: manifest.location.id }];
    }
    if (query.startsWith("insert into retailer_location_channels")) {
      state.channel = {
        id: String(values[0]),
        retailer_location_id: String(values[1]),
        channel_kind: String(values[2]),
        public_destination: String(values[3]),
        channel_state: "pending",
        source_method: String(values[4]),
        source_reference: String(values[5]),
        verified_at: null,
        expires_at: null,
        reviewed_by: null,
        reviewed_at: null,
      };
      state.events.push("insert:channel:pending");
      return [{ id: manifest.location.channel?.id ?? "" }];
    }
    if (query.startsWith("update retailer_location_channels")) {
      assert.ok(state.channel);
      state.channel.channel_state = "verified";
      state.channel.verified_at = String(values[0]);
      state.channel.expires_at = String(values[1]);
      state.channel.reviewed_by = String(values[2]);
      state.channel.reviewed_at = String(values[3]);
      state.events.push("update:channel:verified");
      return [{ id: manifest.location.channel?.id ?? "" }];
    }
    if (query.startsWith("insert into retailer_location_evidence")) {
      const row: EvidenceRow = {
        id: String(values[0]),
        retailer_location_id: String(values[1]),
        channel_id: values[2] === null ? null : String(values[2]),
        evidence_scope: String(values[3]),
        source_method: String(values[4]),
        source_reference: String(values[5]),
        observed_at: String(values[6]),
        expires_at: String(values[7]),
        decision: "pending",
        reviewed_by: null,
        reviewed_at: null,
      };
      state.evidence.set(row.id, row);
      state.events.push(`insert:evidence:${row.evidence_scope}:pending`);
      return [{ id: row.id }];
    }
    if (query.startsWith("update retailer_location_evidence")) {
      const id = String(values[2]);
      const row = state.evidence.get(id);
      assert.ok(row);
      row.decision = "approved";
      row.reviewed_by = String(values[0]);
      row.reviewed_at = String(values[1]);
      state.events.push(`update:evidence:${row.evidence_scope}:approved`);
      return [{ id }];
    }
    if (query.startsWith("insert into physical_product_observations")) {
      state.observation = {
        id: String(values[0]),
        retailer_location_id: String(values[1]),
        product_identity_version_id: String(values[2]),
        availability: String(values[3]),
        price_ngn: values[4] === null ? null : Number(values[4]),
        observed_at: String(values[5]),
        expires_at: String(values[6]),
        source_method: String(values[7]),
        source_reference: String(values[8]),
        observed_title: String(values[9]),
        observed_size: String(values[10]),
        moderation_status: "pending",
        reviewed_by: null,
        reviewed_at: null,
      };
      state.events.push("insert:observation:pending");
      return [{ id: state.observation.id }];
    }
    if (query.startsWith("insert into moderation_audit_log")) {
      state.auditCount += 1;
      state.events.push(
        query.includes("'physical_product_observation'")
          ? "insert:audit:observation"
          : "insert:audit:location",
      );
      return [];
    }
    throw new Error(`Unexpected onboarding fixture query: ${query}`);
  }) as unknown as Sql;
  tag.json = (value) => {
    state.auditMetadata.push(value);
    return value as never;
  };
  const transactionTag = tag as unknown as {
    begin: <T>(
      options: string,
      run: (transaction: Sql) => Promise<T>,
    ) => Promise<T>;
  };
  transactionTag.begin = async (options, run) => {
    state.transactionModes.push(options);
    return run(tag);
  };
  return { manifest, sql: tag as Sql, state };
}

test("the manifest and command are strict, dry-run-first, and evidence-window bounded", () => {
  const manifest = onboardingManifest();
  const command = parseMarketFinderOnboardingCommand([
    "--manifest=./pilot.json",
  ]);
  assert.equal(command.apply, false);
  assert.equal(command.manifestPath, path.resolve("./pilot.json"));
  assert.equal(
    parseMarketFinderOnboardingCommand(["--manifest=./pilot.json", "--apply"])
      .apply,
    true,
  );
  assert.throws(() => parseMarketFinderOnboardingCommand(["--apply"]));
  assert.throws(() =>
    parseMarketFinderOnboardingCommand([
      "--manifest=./pilot.json",
      "--unknown=value",
    ]),
  );

  assert.throws(() =>
    parseMarketFinderOnboardingManifest(
      {
        ...manifest,
        market: { ...manifest.market, slug: "Mainland Market" },
      },
      now,
    ),
  );
  assert.throws(() =>
    parseMarketFinderOnboardingManifest(
      {
        ...manifest,
        market: { ...manifest.market, publicName: "Test Market" },
      },
      now,
    ),
  );
  assert.throws(
    () =>
      parseMarketFinderOnboardingManifest(
        {
          ...manifest,
          location: {
            ...manifest.location,
            channel: {
              ...manifest.location.channel,
              publicDestination:
                "https://wa.me/2348000000000?text=private-order",
            },
          },
        },
        now,
      ),
    /publicDestination/,
  );
  assert.throws(
    () =>
      parseMarketFinderOnboardingManifest(
        {
          ...manifest,
          location: {
            ...manifest.location,
            verificationExpiresAt: "2027-03-01T12:00:00.000Z",
          },
        },
        now,
      ),
    /must be covered by identity evidence/,
  );
  assert.throws(
    () =>
      parseMarketFinderOnboardingManifest(
        {
          ...manifest,
          initialObservation: {
            ...manifest.initialObservation,
            expiresAt: "2026-09-20T12:00:00.000Z",
          },
        },
        now,
      ),
    /initialObservation\.expiresAt: exceeds the source-specific maximum window/,
  );
  assert.throws(
    () =>
      parseMarketFinderOnboardingManifest(
        manifest,
        new Date("2027-02-21T12:00:00.000Z"),
      ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(
        error.message,
        /location\.verificationExpiresAt: must be current at operator time/,
      );
      assert.match(
        error.message,
        /location\.identityEvidence\.expiresAt: must be current at operator time/,
      );
      assert.match(
        error.message,
        /location\.publicDirections\.evidence\.expiresAt: must be current at operator time/,
      );
      assert.match(
        error.message,
        /location\.channel\.expiresAt: must be current at operator time/,
      );
      assert.match(
        error.message,
        /location\.channel\.ownershipEvidence\.expiresAt: must be current at operator time/,
      );
      assert.match(
        error.message,
        /initialObservation\.expiresAt: must be current at operator time/,
      );
      return true;
    },
  );
  assert.throws(() =>
    parseMarketFinderOnboardingManifest({ ...manifest, unexpected: true }, now),
  );
});

test("the manifest accepts deterministic PostgreSQL product identity UUIDs", () => {
  const manifest = onboardingManifest();
  assert.ok(manifest.product);
  const identityVersionId = "1014d3aa-7d8c-b236-7181-85cd399f1d6c";

  const parsed = parseMarketFinderOnboardingManifest(
    {
      ...manifest,
      product: {
        ...manifest.product,
        identityVersionId,
      },
    },
    now,
  );

  assert.equal(parsed.product?.identityVersionId, identityVersionId);
});

test("dry-run resolves exact canonical parents in a read-only transaction and emits no sensitive evidence", async () => {
  const fixture = onboardingFixture();
  const result = await runMarketFinderOnboarding(
    fixture.sql,
    fixture.manifest,
    {
      operatorEmail: "admin@jelocare.invalid",
      now,
    },
  );
  assert.equal(result.mode, "dry-run");
  assert.equal(result.writes, false);
  assert.equal(result.market.action, "create-and-publish");
  assert.equal(result.location.action, "create-and-verify");
  assert.equal(result.initialObservation?.action, "create-pending");
  assert.equal(result.initialObservation?.state, "pending");
  assert.deepEqual(fixture.state.transactionModes, ["read only"]);
  assert.deepEqual(fixture.state.events, []);

  const output = JSON.stringify(result);
  assert.doesNotMatch(output, /private-ledger/);
  assert.doesNotMatch(output, /civic centre/i);
  assert.doesNotMatch(output, /wa\.me/);
  assert.doesNotMatch(output, /Approve one evidence-bound/);
});

test("location-only manifest may omit an unneeded market place", () => {
  const manifest = locationOnlyOnboardingManifest();
  delete manifest.place;

  const parsed = parseMarketFinderOnboardingManifest(manifest, now);

  assert.equal(parsed.place, undefined);
  assert.equal(parsed.product, undefined);
  assert.equal(parsed.initialObservation, undefined);
});

test("location-only dry-run omits product planning and product output", async () => {
  const fixture = onboardingFixture({
    manifest: locationOnlyOnboardingManifest(),
  });
  const result = await runMarketFinderOnboarding(
    fixture.sql,
    fixture.manifest,
    {
      operatorEmail: "admin@jelocare.invalid",
      now,
    },
  );

  assert.equal(result.mode, "dry-run");
  assert.equal(result.writes, false);
  assert.equal(result.product, null);
  assert.equal(result.initialObservation, null);
  assert.deepEqual(fixture.state.transactionModes, ["read only"]);
  assert.deepEqual(fixture.state.events, []);
  assert.equal(
    fixture.state.queries.some((query) =>
      query.includes("from catalogue_product_identity_versions"),
    ),
    false,
  );
  assert.equal(
    fixture.state.queries.some((query) =>
      query.includes("from physical_product_observations"),
    ),
    false,
  );
});

test("location-only apply is audited without product identity and reruns idempotently", async () => {
  const fixture = onboardingFixture({
    manifest: locationOnlyOnboardingManifest(),
  });
  const result = await runMarketFinderOnboarding(
    fixture.sql,
    fixture.manifest,
    {
      apply: true,
      operatorEmail: "admin@jelocare.invalid",
      now,
    },
  );

  assert.equal(result.mode, "applied");
  assert.equal(result.writes, true);
  assert.equal(result.product, null);
  assert.equal(result.initialObservation, null);
  assert.deepEqual(fixture.state.events, [
    "insert:market:draft",
    "update:market:published",
    "insert:place:lead",
    "update:place:verified",
    "insert:location:lead",
    "insert:evidence:location_identity:pending",
    "update:evidence:location_identity:approved",
    "insert:evidence:public_directions:pending",
    "update:evidence:public_directions:approved",
    "update:location:verified",
    "insert:channel:pending",
    "insert:evidence:channel_ownership:pending",
    "update:evidence:channel_ownership:approved",
    "update:channel:verified",
    "insert:audit:location",
  ]);
  assert.equal(fixture.state.auditCount, 1);
  assert.equal(fixture.state.auditMetadata.length, 1);
  assert.equal(
    Object.hasOwn(
      fixture.state.auditMetadata[0] as object,
      "identityVersionId",
    ),
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(fixture.state.auditMetadata[0]),
    /33333333-3333-4333-8333-333333333333|22222222-2222-4222-8222-222222222222/,
  );

  const eventCount = fixture.state.events.length;
  const queryCount = fixture.state.queries.length;
  const rerun = await runMarketFinderOnboarding(fixture.sql, fixture.manifest, {
    apply: true,
    operatorEmail: "admin@jelocare.invalid",
    now,
  });
  assert.equal(rerun.writes, false);
  assert.equal(rerun.product, null);
  assert.equal(rerun.initialObservation, null);
  assert.equal(fixture.state.events.length, eventCount);
  assert.equal(fixture.state.auditCount, 1);
  assert.equal(
    fixture.state.queries
      .slice(queryCount)
      .some((query) =>
        query.includes("from catalogue_product_identity_versions"),
      ),
    false,
  );
});

test("an initial observation without an exact product identity is rejected", () => {
  const manifest = onboardingManifest();
  delete manifest.product;
  assert.throws(
    () => parseMarketFinderOnboardingManifest(manifest, now),
    /An exact product identity is required when initialObservation is provided/,
  );
});

test("apply follows trigger-safe pending-to-approved order, audits atomically, and reruns as a no-op", async () => {
  const fixture = onboardingFixture();
  const result = await runMarketFinderOnboarding(
    fixture.sql,
    fixture.manifest,
    {
      apply: true,
      operatorEmail: "admin@jelocare.invalid",
      now,
    },
  );
  assert.equal(result.mode, "applied");
  assert.equal(result.writes, true);
  assert.deepEqual(fixture.state.transactionModes, [
    "isolation level serializable",
  ]);
  assert.deepEqual(fixture.state.events, [
    "insert:market:draft",
    "update:market:published",
    "insert:place:lead",
    "update:place:verified",
    "insert:location:lead",
    "insert:evidence:location_identity:pending",
    "update:evidence:location_identity:approved",
    "insert:evidence:public_directions:pending",
    "update:evidence:public_directions:approved",
    "update:location:verified",
    "insert:channel:pending",
    "insert:evidence:channel_ownership:pending",
    "update:evidence:channel_ownership:approved",
    "update:channel:verified",
    "insert:observation:pending",
    "insert:audit:observation",
    "insert:audit:location",
  ]);
  assert.equal(fixture.state.observation?.moderation_status, "pending");
  assert.equal(fixture.state.observation?.reviewed_by, null);

  const eventCount = fixture.state.events.length;
  const auditCount = fixture.state.auditCount;
  const rerun = await runMarketFinderOnboarding(fixture.sql, fixture.manifest, {
    apply: true,
    operatorEmail: "admin@jelocare.invalid",
    now,
  });
  assert.equal(rerun.writes, false);
  assert.equal(rerun.market.action, "unchanged");
  assert.equal(rerun.location.action, "unchanged");
  assert.equal(rerun.channel?.action, "unchanged");
  assert.equal(rerun.initialObservation?.action, "unchanged");
  assert.equal(rerun.initialObservation?.state, "pending");
  assert.equal(fixture.state.events.length, eventCount);
  assert.equal(fixture.state.auditCount, auditCount);

  await assert.rejects(
    () =>
      runMarketFinderOnboarding(fixture.sql, fixture.manifest, {
        apply: true,
        operatorEmail: "admin@jelocare.invalid",
        now: new Date("2026-09-11T12:00:00.000Z"),
      }),
    /initialObservation\.expiresAt: must be current at operator time/,
  );
  assert.equal(fixture.state.events.length, eventCount);
  assert.equal(fixture.state.auditCount, auditCount);
});

test("canonical conflicts and non-admin authority fail closed before any write", async () => {
  const conflict = onboardingFixture({ conflictingRetailer: true });
  await assert.rejects(
    () =>
      runMarketFinderOnboarding(conflict.sql, conflict.manifest, {
        apply: true,
        operatorEmail: "admin@jelocare.invalid",
        now,
      }),
    /Canonical retailer is missing or conflicts/,
  );
  assert.deepEqual(conflict.state.events, []);

  const operator = onboardingFixture({ operatorRole: "operator" });
  await assert.rejects(
    () =>
      runMarketFinderOnboarding(operator.sql, operator.manifest, {
        apply: true,
        operatorEmail: "operator@jelocare.invalid",
        now,
      }),
    /exactly one active admin/,
  );
  assert.deepEqual(operator.state.events, []);
});

test("operator resolution and source contract use only protected authority inputs", async () => {
  const fixture = onboardingFixture();
  assert.equal(
    await resolveMarketFinderOnboardingAdmin(
      fixture.sql,
      "admin@jelocare.invalid",
    ),
    operatorSubject,
  );
  const source = await readFile(
    path.join(process.cwd(), "scripts/onboard-market-finder-pilot.ts"),
    "utf8",
  );
  const environmentNames = [
    ...source.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g),
  ].map((match) => match[1]);
  assert.deepEqual([...new Set(environmentNames)].sort(), [
    "MIGRATION_DATABASE_URL",
    "MODERATION_OPERATOR_EMAIL",
  ]);
  assert.match(source, /requireAdminDatabaseUrl\(\{/);
  assert.match(
    source,
    /apply \? ["']isolation level serializable["'] : ["']read only["']/,
  );
  assert.match(source, /and active = true/);
  assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|POSTGRES_URL)/);
  assert.match(source, /insert into physical_product_observations/);
  assert.doesNotMatch(source, /update physical_product_observations/);
  assert.match(source, /physical_product_observations[\s\S]*?['"]pending['"]/);
  assert.doesNotMatch(source, /Trade Fair|COSRX|Mainland Beauty Market/i);
});
