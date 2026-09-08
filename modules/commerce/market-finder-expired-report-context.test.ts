import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrations = {
  atomicContext: "db/migrations/0055_market_finder_atomic_context.sql",
  expiredReportRenewal:
    "db/migrations/0057_market_finder_expired_report_renewal.sql",
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

function normalizeSql(source: string) {
  return source.replace(/\s+/g, " ").trim();
}

function extractBalancedExpression(source: string, openIndex: number) {
  assert.equal(source[openIndex], "(", "balanced expression must start at (");

  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    if (source[index] === ")") depth -= 1;
    if (depth === 0) return source.slice(openIndex, index + 1);
  }

  assert.fail("balanced expression must have a closing )");
}

function existsExpressionFor(
  source: string,
  relationMarker: string,
  afterIndex = 0,
) {
  const relationIndex = source.indexOf(relationMarker, afterIndex);
  assert.ok(relationIndex >= 0, `${relationMarker} must be present`);

  const existsIndex = source.lastIndexOf("exists (", relationIndex);
  assert.ok(
    existsIndex >= afterIndex,
    `${relationMarker} must be inside exists`,
  );
  const openIndex = source.indexOf("(", existsIndex);
  return `exists ${extractBalancedExpression(source, openIndex)}`;
}

test("0057 is one atomic validator replacement", async () => {
  const source = await readFile(migrations.expiredReportRenewal, "utf8");
  const replacements = [
    ...source.matchAll(
      /create or replace function public\.([a-z0-9_]+)\s*\(/gi,
    ),
  ].map((match) => match[1]);

  assert.deepEqual(replacements, ["market_finder_validate_report_context"]);
  assert.match(source, /^begin;[\s\S]*commit;\s*$/);
  assert.equal(source.match(/^begin;$/gm)?.length, 1);
  assert.equal(source.match(/^commit;$/gm)?.length, 1);

  const validator = functionDefinition(
    source,
    "market_finder_validate_report_context",
  );
  const isolation = validator.indexOf(
    "current_setting('transaction_isolation') <> 'read committed'",
  );
  const lock = validator.indexOf("pg_advisory_xact_lock(");
  const freshClock = validator.indexOf(
    "validation_now := pg_catalog.clock_timestamp()",
  );

  assert.ok(isolation >= 0);
  assert.ok(lock > isolation);
  assert.ok(freshClock > lock);
  assert.equal(
    validator.match(/validation_now := pg_catalog\.clock_timestamp\(\)/g)
      ?.length,
    1,
  );
  assert.doesNotMatch(
    validator,
    /statement_timestamp\(\)|transaction_timestamp\(\)|\bnow\(\)/,
  );
});

test("0057 preserves the 0055 verified context and exact identity gates", async () => {
  const [priorSource, renewalSource] = await Promise.all([
    readFile(migrations.atomicContext, "utf8"),
    readFile(migrations.expiredReportRenewal, "utf8"),
  ]);
  const priorValidator = functionDefinition(
    priorSource,
    "market_finder_validate_report_context",
  );
  const renewalValidator = functionDefinition(
    renewalSource,
    "market_finder_validate_report_context",
  );
  const observationStart =
    "  if not exists (\n    select 1\n    from public.retailer_locations location\n    join lateral (";
  const priorObservationStart = priorValidator.indexOf(observationStart);
  const renewalObservationStart = renewalValidator.indexOf(observationStart);

  assert.ok(priorObservationStart >= 0);
  assert.ok(renewalObservationStart >= 0);
  assert.equal(
    renewalValidator.slice(0, renewalObservationStart),
    priorValidator.slice(0, priorObservationStart),
  );

  assert.match(
    renewalValidator,
    /market\.publication_state = ["']published["'][\s\S]*?location\.location_state = ["']verified["'][\s\S]*?location\.verification_expires_at > validation_now/,
  );
  assert.match(
    renewalValidator,
    /location\.primary_place_id is null[\s\S]*?place\.place_state = ["']verified["']/,
  );
  assert.match(
    renewalValidator,
    /identity_evidence\.evidence_scope = ["']location_identity["'][\s\S]*?identity_evidence\.channel_id is null[\s\S]*?identity_evidence\.decision = ["']approved["'][\s\S]*?identity_evidence\.expires_at > validation_now/,
  );
  assert.match(
    renewalValidator,
    /identity_version\.identity_version_id = new\.product_identity_version_id[\s\S]*?identity_version\.lifecycle_state = ["']active["'][\s\S]*?product\.is_published = true/,
  );
});

test("0057 preserves the latest approved non-superseded observation", async () => {
  const [priorSource, renewalSource] = await Promise.all([
    readFile(migrations.atomicContext, "utf8"),
    readFile(migrations.expiredReportRenewal, "utf8"),
  ]);
  const priorValidator = functionDefinition(
    priorSource,
    "market_finder_validate_report_context",
  );
  const renewalValidator = functionDefinition(
    renewalSource,
    "market_finder_validate_report_context",
  );
  const observationStart =
    "  if not exists (\n    select 1\n    from public.retailer_locations location\n    join lateral (";
  const priorStart = priorValidator.indexOf(observationStart);
  const renewalStart = renewalValidator.indexOf(observationStart);
  const priorEligibility = priorValidator.indexOf(
    "\n      and observation.expires_at > validation_now",
    priorStart,
  );
  const renewalEligibility = renewalValidator.indexOf(
    "\n      and (\n        observation.expires_at <= validation_now",
    renewalStart,
  );

  assert.ok(priorStart >= 0);
  assert.ok(renewalStart >= 0);
  assert.ok(priorEligibility > priorStart);
  assert.ok(renewalEligibility > renewalStart);
  assert.equal(
    renewalValidator.slice(renewalStart, renewalEligibility),
    priorValidator.slice(priorStart, priorEligibility),
  );
  assert.match(
    renewalValidator.slice(renewalStart, renewalEligibility),
    /approved_observation\.moderation_status = ["']approved["'][\s\S]*?not exists \([\s\S]*?approved_successor\.supersedes_observation_id = approved_observation\.id[\s\S]*?approved_successor\.moderation_status = ["']approved["'][\s\S]*?order by\s+approved_observation\.observed_at desc,\s+approved_observation\.created_at desc,\s+approved_observation\.id desc\s+limit 1/,
  );
});

test("0057 admits expired evidence or a current positive result with a current safe action", async () => {
  const [priorSource, renewalSource] = await Promise.all([
    readFile(migrations.atomicContext, "utf8"),
    readFile(migrations.expiredReportRenewal, "utf8"),
  ]);
  const priorValidator = functionDefinition(
    priorSource,
    "market_finder_validate_report_context",
  );
  const renewalValidator = functionDefinition(
    renewalSource,
    "market_finder_validate_report_context",
  );
  const expiredIndex = renewalValidator.indexOf(
    "observation.expires_at <= validation_now",
  );
  const predicateOpen = renewalValidator.lastIndexOf("(", expiredIndex);
  const predicate = extractBalancedExpression(renewalValidator, predicateOpen);
  const normalizedPredicate = normalizeSql(predicate);
  const topLevelOr = normalizedPredicate.indexOf(" or (");

  assert.ok(expiredIndex >= 0);
  assert.equal(
    normalizedPredicate.slice(0, topLevelOr),
    "( observation.expires_at <= validation_now",
  );
  assert.match(
    normalizedPredicate,
    /^\( observation\.expires_at <= validation_now or \( observation\.expires_at > validation_now and observation\.availability in \(["']in_stock["'], ["']low_stock["']\) and \( exists \([\s\S]+\) or exists \([\s\S]+\) \) \) \)$/,
  );

  for (const relation of [
    "from public.retailer_location_evidence directions_evidence",
    "from public.retailer_location_channels channel",
  ]) {
    assert.equal(
      normalizeSql(
        existsExpressionFor(renewalValidator, relation, expiredIndex),
      ),
      normalizeSql(existsExpressionFor(priorValidator, relation)),
    );
  }

  assert.match(
    predicate,
    /directions_evidence\.decision = ["']approved["'][\s\S]*?directions_evidence\.expires_at > validation_now/,
  );
  assert.match(
    predicate,
    /channel\.channel_state = ["']verified["'][\s\S]*?channel\.expires_at > validation_now[\s\S]*?market_finder_public_action_is_usable/,
  );
  assert.equal(
    renewalValidator.match(/observation\.expires_at <= validation_now/g)
      ?.length,
    1,
  );
  assert.equal(
    renewalValidator.match(/observation\.expires_at > validation_now/g)?.length,
    1,
  );
});

test("0057 has no schema, privilege, or data mutation scope", async () => {
  const source = await readFile(migrations.expiredReportRenewal, "utf8");

  assert.doesNotMatch(
    source,
    /\b(?:create|alter|drop)\s+(?:table|type|index|trigger|policy|schema|extension)\b/i,
  );
  assert.doesNotMatch(source, /\b(?:grant|revoke)\b/i);
  assert.doesNotMatch(
    source,
    /\b(?:insert\s+into|update\s+(?:only\s+)?(?:public\.)?[a-z0-9_]+|delete\s+from|truncate(?:\s+table)?|merge\s+into)\b/i,
  );
});
