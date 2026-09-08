import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const canonicalExpandMigration =
  "db/migrations/0056_customer_concern_hard_delete.sql";
const rehearsalExpandMigration =
  ".migration-rehearsal/0056_customer_concern_hard_delete.sql";
const canonicalContractMigration =
  "db/migrations/0058_customer_concern_hard_delete_contract.sql";
const rehearsalContractMigration =
  ".migration-rehearsal/0058_customer_concern_hard_delete_contract.sql";

function currentMigrationSource(canonical: string, rehearsal: string) {
  const path = existsSync(canonical) ? canonical : rehearsal;
  assert.ok(
    existsSync(path),
    "the exact 0056 migration must exist as a rehearsal draft or promoted canonical file",
  );
  return readFileSync(path, "utf8");
}

function assertSchemaCoupledConcernAcl(source: string) {
  const start = source.indexOf("concern_relation.relrowsecurity");
  const finish = source.indexOf("as concerns_shelf_privileges_exact", start);
  assert.ok(start >= 0 && finish > start);
  const contract = source.slice(start, finish);
  const branch = contract.indexOf("case when exists");
  const legacyAcl = contract.indexOf(
    "array['INSERT:false', 'SELECT:false', 'UPDATE:false']::text[]",
  );
  const expandedAcl = contract.indexOf(
    "array['DELETE:false', 'INSERT:false', 'SELECT:false', 'UPDATE:false']::text[]",
  );
  const otherwise = contract.indexOf("else", expandedAcl);
  const finalAcl = contract.indexOf(
    "array['DELETE:false', 'INSERT:false', 'SELECT:false']::text[]",
  );

  assert.ok(branch >= 0);
  assert.match(contract, /attribute\.attname = 'removed_at'/);
  assert.match(contract, /not attribute\.attisdropped/);
  assert.ok(legacyAcl > branch && legacyAcl < otherwise);
  assert.ok(expandedAcl > legacyAcl && expandedAcl < otherwise);
  assert.ok(finalAcl > otherwise);
}

test("0056 expands Concern delete authority without breaking the deployed schema", () => {
  const migration = currentMigrationSource(
    canonicalExpandMigration,
    rehearsalExpandMigration,
  );

  assert.match(
    migration,
    /delete from public\.customer_concerns\s+where removed_at is not null/,
  );
  assert.match(
    migration,
    /grant delete on table public\.customer_concerns to jelocare_shelf_runtime/,
  );
  assert.doesNotMatch(migration, /drop column removed_at/);
  assert.doesNotMatch(migration, /revoke update/);
});

test("0058 contracts tombstone storage and UPDATE authority after the bridge", () => {
  const migration = currentMigrationSource(
    canonicalContractMigration,
    rehearsalContractMigration,
  );
  const exclusiveLock = migration.indexOf(
    "lock table public.customer_concerns in access exclusive mode",
  );
  const tombstoneDelete = migration.indexOf(
    "delete from public.customer_concerns",
  );
  const removedColumnDrop = migration.indexOf("drop column removed_at");

  assert.ok(exclusiveLock >= 0);
  assert.ok(tombstoneDelete > exclusiveLock);
  assert.ok(removedColumnDrop > tombstoneDelete);
  assert.match(
    migration.slice(tombstoneDelete, removedColumnDrop),
    /where removed_at is not null/,
  );
  assert.match(
    migration,
    /drop index public\.customer_concerns_owner_slug_active_idx/,
  );
  assert.match(
    migration,
    /drop constraint customer_concerns_owner_subject_concern_slug_removed_at_key/,
  );
  assert.match(
    migration,
    /add constraint customer_concerns_owner_slug_key\s+unique \(owner_subject, concern_slug\)/,
  );
  assert.match(
    migration,
    /revoke update on table public\.customer_concerns from jelocare_shelf_runtime/,
  );
  assert.doesNotMatch(migration, /grant delete/);
  assert.doesNotMatch(migration, /truncate|drop table/i);
});

test("Concern repository spans pre-expand, expanded, and contracted schemas", () => {
  const repository = readFileSync("lib/customer/concern-repository.ts", "utf8");

  assert.match(repository, /pg_catalog\.to_jsonb\(concern\) ->> 'removed_at'/);
  assert.match(repository, /has_table_privilege\([\s\S]*?'DELETE'/);
  assert.match(repository, /if \(!\(await concernHardDeleteAvailable/);
  assert.equal(
    repository.match(/update public\.customer_concerns/g)?.length,
    2,
  );
  assert.match(repository, /on conflict do nothing/);
  assert.equal(
    repository.match(/delete from public\.customer_concerns/g)?.length,
    2,
  );
});

test("Concern rollback audit proves owner delete, re-add, clear, and isolation", () => {
  const audit = readFileSync("scripts/audit-customer-shelf-rls.ts", "utf8");

  assertSchemaCoupledConcernAcl(audit);
  assert.match(audit, /ownerConcernRemove\.length !== 1/);
  assert.match(audit, /ownerConcernReAdd\.length !== 1/);
  assert.match(audit, /crossOwnerConcernDelete\.length !== 0/);
  assert.match(audit, /ownerConcernClear\.length !== 1/);
  assert.doesNotMatch(audit, /update public\.customer_concerns/);
});

test("Shelf runtime attestation couples each cutover ACL to its schema", () => {
  const database = readFileSync("lib/customer/shelf-database.ts", "utf8");

  assertSchemaCoupledConcernAcl(database);
});

test("Concern ADR records the approved live-row retention boundary", () => {
  const adr = readFileSync(
    "docs/adr/0015-customer-concern-consultation.md",
    "utf8",
  );

  assert.match(adr, /Removal\s+and clear hard-delete the owned live rows/);
  assert.match(adr, /exports include current active\s+Concerns only/i);
  assert.doesNotMatch(adr, /sets? `removed_at`/);
});
