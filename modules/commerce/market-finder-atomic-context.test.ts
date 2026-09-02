import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { migrationBytesSha256 } from "../../lib/database/migration-governance";

const migrations = {
  physicalFoundation: "db/migrations/0053_physical_market_finder.sql",
  reportContext: "db/migrations/0054_market_finder_report_current_context.sql",
  atomicContext: "db/migrations/0055_market_finder_atomic_context.sql",
} as const;

function functionDefinition(source: string, name: string) {
  const definition = source.match(
    new RegExp(
      `create or replace function public\\.${name}\\(\\)[\\s\\S]*?\\n\\$\\$;`,
    ),
  );
  assert.ok(definition, `${name} must have a complete replacement definition`);
  return definition[0];
}

test("0055 preserves the immutable 0053 and 0054 migration bytes", async () => {
  const [physicalFoundation, reportContext] = await Promise.all([
    readFile(migrations.physicalFoundation),
    readFile(migrations.reportContext),
  ]);

  assert.equal(
    migrationBytesSha256(physicalFoundation),
    "9f959c3431b6a1b62912e6fe1b7e5e06e62f28a7956d26c5691ec74703c8f078",
  );
  assert.equal(
    migrationBytesSha256(reportContext),
    "62081dd7c9936c6a4e1d25f1ff39cf0c9e63d757f8d0b25ad61ea4f2234c1e7f",
  );
});

test("0055 preserves original reviewer attribution during supersession", async () => {
  const source = await readFile(migrations.atomicContext, "utf8");
  const evidenceHistory = functionDefinition(
    source,
    "market_finder_enforce_evidence_history",
  );
  const evidenceSupersession = functionDefinition(
    source,
    "market_finder_apply_evidence_supersession",
  );
  const observationHistory = functionDefinition(
    source,
    "market_finder_enforce_observation_history",
  );
  const observationSupersession = functionDefinition(
    source,
    "market_finder_apply_observation_supersession",
  );

  assert.match(
    evidenceHistory,
    /Supersession must preserve the original evidence reviewer/,
  );
  assert.match(
    observationHistory,
    /Supersession must preserve the original observation reviewer/,
  );
  assert.match(
    evidenceSupersession,
    /set decision = ["']superseded["']\s+where/,
  );
  assert.match(
    observationSupersession,
    /set moderation_status = ["']superseded["']\s+where/,
  );
  for (const supersession of [evidenceSupersession, observationSupersession]) {
    assert.doesNotMatch(supersession, /reviewed_by\s*=\s*new\.reviewed_by/);
    assert.doesNotMatch(supersession, /reviewed_at\s*=\s*new\.reviewed_at/);
  }
});

test("0055 serializes all eight report-eligibility relations with one lock key", async () => {
  const source = await readFile(migrations.atomicContext, "utf8");
  const triggers = [
    ...source.matchAll(
      /create trigger\s+([a-z0-9_]+)\s+before\s+([^;]+?)\s+on public\.([a-z0-9_]+)\s+for each statement execute function public\.market_finder_lock_context_write\(\);/g,
    ),
  ].map((match) => ({
    name: match[1],
    events: match[2]?.replace(/\s+/g, " ").trim(),
    table: match[3],
  }));

  assert.deepEqual(triggers, [
    {
      name: "physical_markets_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "physical_markets",
    },
    {
      name: "physical_market_places_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "physical_market_places",
    },
    {
      name: "retailer_locations_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "retailer_locations",
    },
    {
      name: "retailer_location_channels_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "retailer_location_channels",
    },
    {
      name: "retailer_location_evidence_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "retailer_location_evidence",
    },
    {
      name: "products_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "products",
    },
    {
      name: "catalogue_identity_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "catalogue_product_identity_versions",
    },
    {
      name: "physical_observations_market_finder_context_lock_trigger",
      events: "insert or update or delete",
      table: "physical_product_observations",
    },
  ]);

  const sharedLock =
    /pg_catalog\.pg_advisory_xact_lock\(\s*pg_catalog\.hashtext\(["']jelocare:market-finder["']\),\s*pg_catalog\.hashtext\(["']current-context["']\)\s*\)/g;
  assert.equal(source.match(sharedLock)?.length, 2);
});

test("0055 validates reports after the READ COMMITTED lock with a fresh clock", async () => {
  const source = await readFile(migrations.atomicContext, "utf8");
  const validator = functionDefinition(
    source,
    "market_finder_validate_report_context",
  );

  assert.match(validator, /language plpgsql\s+volatile/);
  assert.match(
    validator,
    /current_setting\(["']transaction_isolation["']\) <> ["']read committed["'][\s\S]*?pg_advisory_xact_lock\([\s\S]*?validation_now := pg_catalog\.clock_timestamp\(\)/,
  );
  assert.doesNotMatch(validator, /statement_timestamp\(\)/);
  assert.match(
    validator,
    /parent_retain_until <= validation_now[\s\S]*?verification_expires_at > validation_now[\s\S]*?identity_evidence\.expires_at > validation_now[\s\S]*?observation\.expires_at > validation_now[\s\S]*?directions_evidence\.expires_at > validation_now[\s\S]*?channel_evidence\.expires_at > validation_now[\s\S]*?channel\.expires_at > validation_now/,
  );
});

test("0055 excludes TRUNCATE from context triggers and revokes that authority", async () => {
  const source = await readFile(migrations.atomicContext, "utf8");
  const triggerStatements = [
    ...source.matchAll(
      /create trigger[\s\S]*?execute function public\.market_finder_lock_context_write\(\);/g,
    ),
  ];
  assert.equal(triggerStatements.length, 8);
  for (const statement of triggerStatements) {
    assert.doesNotMatch(statement[0], /\btruncate\b/i);
  }

  const revoke = source.match(
    /revoke truncate on table\s+([\s\S]*?)\s+from public,\s*jelocare_app_runtime;/i,
  );
  assert.ok(revoke, "TRUNCATE must be revoked from public and runtime roles");
  assert.deepEqual(
    [...revoke[1]!.matchAll(/public\.([a-z0-9_]+)/g)].map((match) => match[1]),
    [
      "physical_markets",
      "physical_market_places",
      "retailer_locations",
      "retailer_location_channels",
      "retailer_location_evidence",
      "products",
      "catalogue_product_identity_versions",
      "physical_product_observations",
    ],
  );
});

test("0055 audits prior supersessions only after both evidence triggers exist", async () => {
  const source = await readFile(migrations.atomicContext, "utf8");
  const evidenceTrigger = source.indexOf(
    "create trigger retailer_location_evidence_market_finder_context_lock_trigger",
  );
  const observationTrigger = source.indexOf(
    "create trigger physical_observations_market_finder_context_lock_trigger",
  );
  const audit = source.indexOf("do $audit$");

  assert.ok(evidenceTrigger >= 0);
  assert.ok(observationTrigger >= 0);
  assert.ok(audit > evidenceTrigger);
  assert.ok(audit > observationTrigger);
  assert.match(
    source.slice(audit),
    /retailer_location_evidence[\s\S]*decision = ["']superseded["'][\s\S]*physical_product_observations[\s\S]*moderation_status = ["']superseded["']/,
  );
});
