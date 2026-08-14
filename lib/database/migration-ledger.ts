import postgres from "postgres";
import {
  buildMigrationPlan,
  reconciliationColumns,
  type MigrationColumnEvidence,
  type MigrationDefinition,
  type MigrationLedgerRow,
  type MigrationLedgerSnapshot,
} from "./migration-governance";

export const MIGRATION_ADVISORY_LOCK_KEY = 7_413_902_026;

const governedColumns = [
  "applied_at",
  "checksum_sha256",
  "filename",
  "migration_order",
  "provenance",
  "reconciliation_reference",
  "recorded_at",
  "recorded_by",
  "version",
] as const;

const governedConstraints = [
  "schema_migrations_checksum_check",
  "schema_migrations_filename_version_check",
  "schema_migrations_migration_order_check",
  "schema_migrations_migration_order_key",
  "schema_migrations_pkey",
  "schema_migrations_provenance_check",
  "schema_migrations_provenance_details_check",
  "schema_migrations_reference_check",
  "schema_migrations_version_filename_check",
  "schema_migrations_version_check",
] as const;

const governedVersionIndex = "schema_migrations_unique_version_idx";

const immutabilityTriggers = [
  "schema_migrations_immutable_rows",
  "schema_migrations_immutable_truncate",
] as const;

export const GOVERNED_MIGRATION_LEDGER_DDL = `
create table public.schema_migrations (
  filename text,
  version integer not null,
  migration_order integer not null,
  checksum_sha256 text not null,
  provenance text not null,
  applied_at timestamptz,
  recorded_at timestamptz not null default transaction_timestamp(),
  recorded_by text not null default current_user,
  reconciliation_reference text,
  constraint schema_migrations_pkey primary key (filename),
  constraint schema_migrations_version_check check (version > 0),
  constraint schema_migrations_migration_order_check check (migration_order > 0),
  constraint schema_migrations_migration_order_key unique (migration_order),
  constraint schema_migrations_checksum_check check (
    checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint schema_migrations_filename_version_check check (
    filename ~ '^[0-9]{4}_[a-z0-9]+(_[a-z0-9]+)*[.]sql$'
    and version = substring(filename from 1 for 4)::integer
  ),
  constraint schema_migrations_version_filename_check check (
    version <> 46
    or (
      filename = '0046_fix_customer_request_signal_bridge.sql'
      and checksum_sha256 = 'fcccf32b889ce18ce3ed84568427c919787f5cb66a646b324f8d2d9cdbdadc59'
    )
    or (
      filename = '0046_service_fee_policies.sql'
      and checksum_sha256 = '158d6b84f220348f929aa1b9d3ca0d09bdcd151ca96e52d2932a487fe14e6d41'
    )
  ),
  constraint schema_migrations_provenance_check check (provenance in (
    'runner_atomic', 'legacy_filename_record', 'schema_effect_reconciliation'
  )),
  constraint schema_migrations_reference_check check (
    reconciliation_reference is null
    or reconciliation_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,119}$'
  ),
  constraint schema_migrations_provenance_details_check check (
    (
      provenance = 'runner_atomic'
      and applied_at is not null
      and reconciliation_reference is null
    )
    or (
      provenance = 'legacy_filename_record'
      and reconciliation_reference is not null
    )
    or (
      provenance = 'schema_effect_reconciliation'
      and applied_at is null
      and reconciliation_reference is not null
    )
  )
);

create unique index schema_migrations_unique_version_idx
  on public.schema_migrations (version)
  where version <> 46;

revoke all privileges on table public.schema_migrations from public;

create function public.reject_schema_migration_ledger_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'schema_migrations is append-only; use a reviewed forward repair.'
    using errcode = '55000';
end
$$;

revoke all privileges on function public.reject_schema_migration_ledger_mutation()
  from public;

create trigger schema_migrations_immutable_rows
before update or delete on public.schema_migrations
for each row execute function public.reject_schema_migration_ledger_mutation();

create trigger schema_migrations_immutable_truncate
before truncate on public.schema_migrations
for each statement execute function public.reject_schema_migration_ledger_mutation();

comment on table public.schema_migrations is
  'Append-only migration ledger. Checksums attest according to each row provenance.';
`;

const LEGACY_LEDGER_UPGRADE_PREFIX = `
alter table public.schema_migrations
  alter column applied_at drop not null,
  add column version integer,
  add column migration_order integer,
  add column checksum_sha256 text,
  add column provenance text,
  add column recorded_at timestamptz,
  add column recorded_by text,
  add column reconciliation_reference text;
`;

const LEGACY_LEDGER_UPGRADE_SUFFIX = `
alter table public.schema_migrations
  alter column version set not null,
  alter column migration_order set not null,
  alter column checksum_sha256 set not null,
  alter column provenance set not null,
  alter column recorded_at set not null,
  alter column recorded_by set not null,
  add constraint schema_migrations_version_check check (version > 0),
  add constraint schema_migrations_migration_order_check check (migration_order > 0),
  add constraint schema_migrations_migration_order_key unique (migration_order),
  add constraint schema_migrations_checksum_check check (
    checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  add constraint schema_migrations_filename_version_check check (
    filename ~ '^[0-9]{4}_[a-z0-9]+(_[a-z0-9]+)*[.]sql$'
    and version = substring(filename from 1 for 4)::integer
  ),
  add constraint schema_migrations_version_filename_check check (
    version <> 46
    or (
      filename = '0046_fix_customer_request_signal_bridge.sql'
      and checksum_sha256 = 'fcccf32b889ce18ce3ed84568427c919787f5cb66a646b324f8d2d9cdbdadc59'
    )
    or (
      filename = '0046_service_fee_policies.sql'
      and checksum_sha256 = '158d6b84f220348f929aa1b9d3ca0d09bdcd151ca96e52d2932a487fe14e6d41'
    )
  ),
  add constraint schema_migrations_provenance_check check (provenance in (
    'runner_atomic', 'legacy_filename_record', 'schema_effect_reconciliation'
  )),
  add constraint schema_migrations_reference_check check (
    reconciliation_reference is null
    or reconciliation_reference ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{2,119}$'
  ),
  add constraint schema_migrations_provenance_details_check check (
    (
      provenance = 'runner_atomic'
      and applied_at is not null
      and reconciliation_reference is null
    )
    or (
      provenance = 'legacy_filename_record'
      and reconciliation_reference is not null
    )
    or (
      provenance = 'schema_effect_reconciliation'
      and applied_at is null
      and reconciliation_reference is not null
    )
  );

create unique index schema_migrations_unique_version_idx
  on public.schema_migrations (version)
  where version <> 46;

revoke all privileges on table public.schema_migrations from public;

create or replace function public.reject_schema_migration_ledger_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'schema_migrations is append-only; use a reviewed forward repair.'
    using errcode = '55000';
end
$$;

revoke all privileges on function public.reject_schema_migration_ledger_mutation()
  from public;

create trigger schema_migrations_immutable_rows
before update or delete on public.schema_migrations
for each row execute function public.reject_schema_migration_ledger_mutation();

create trigger schema_migrations_immutable_truncate
before truncate on public.schema_migrations
for each statement execute function public.reject_schema_migration_ledger_mutation();

comment on table public.schema_migrations is
  'Append-only migration ledger. Checksums attest according to each row provenance.';
`;

type SqlClient = ReturnType<typeof postgres>;
type BeginCallback = NonNullable<Parameters<SqlClient["begin"]>[1]>;
type TransactionSql = Parameters<BeginCallback>[0];

type CatalogColumn = {
  columnName: string;
  dataType: string;
  nullable: string;
  columnDefault: string | null;
};
type CatalogConstraint = { constraintName: string; validated: boolean };
type CatalogTrigger = { triggerName: string; enabled: string };
type CatalogIndex = {
  indexName: string;
  unique: boolean;
  valid: boolean;
  predicate: string | null;
};
type JsonLedgerRow = { record: Record<string, unknown> };

function exactSet(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    expected.every((value) => actual.includes(value))
  );
}

function columnMatches(
  columns: ReadonlyMap<string, CatalogColumn>,
  name: string,
  dataType: string,
  nullable: "YES" | "NO",
) {
  const column = columns.get(name);
  return column?.dataType === dataType && column.nullable === nullable;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function nullableString(value: unknown) {
  return value === null ? null : optionalString(value);
}

function optionalInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function normalizeLedgerRow(
  record: Record<string, unknown>,
): MigrationLedgerRow {
  return {
    filename: String(record.filename ?? ""),
    version: optionalInteger(record.version),
    migrationOrder: optionalInteger(record.migration_order),
    checksumSha256: optionalString(record.checksum_sha256),
    provenance: optionalString(record.provenance),
    appliedAt: nullableString(record.applied_at),
    recordedAt: optionalString(record.recorded_at),
    recordedBy: optionalString(record.recorded_by),
    reconciliationReference: nullableString(record.reconciliation_reference),
  };
}

export async function readMigrationLedgerSnapshot(
  sql: SqlClient | TransactionSql,
): Promise<MigrationLedgerSnapshot> {
  const [table] = await sql<{ tableName: string | null }[]>`
    select pg_catalog.to_regclass('public.schema_migrations')::text as "tableName"
  `;
  if (!table?.tableName) {
    const [relations] = await sql<{ relationCount: number | string }[]>`
      select count(*)::int as "relationCount"
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
    `;
    const relationCount = Number(relations?.relationCount ?? 0);
    return {
      shape: "absent",
      immutable: false,
      rows: [],
      details:
        relationCount > 0
          ? `Migration ledger is absent while public schema contains ${relationCount} durable relations.`
          : undefined,
    };
  }

  const columns = await sql<CatalogColumn[]>`
    select column_name as "columnName",
           data_type as "dataType",
           is_nullable as nullable,
           column_default as "columnDefault"
    from information_schema.columns
    where table_schema = 'public' and table_name = 'schema_migrations'
    order by column_name
  `;
  const columnNames = columns.map((column) => column.columnName);
  const columnsByName = new Map(
    columns.map((column) => [column.columnName, column]),
  );
  const legacyNames = exactSet(columnNames, ["applied_at", "filename"]);
  const legacy =
    legacyNames &&
    columnMatches(columnsByName, "filename", "text", "NO") &&
    columnMatches(
      columnsByName,
      "applied_at",
      "timestamp with time zone",
      "NO",
    ) &&
    /now\(\)/i.test(columnsByName.get("applied_at")?.columnDefault ?? "");
  const governedNames = exactSet(columnNames, governedColumns);
  const governed =
    governedNames &&
    columnMatches(columnsByName, "filename", "text", "NO") &&
    columnMatches(columnsByName, "version", "integer", "NO") &&
    columnMatches(columnsByName, "migration_order", "integer", "NO") &&
    columnMatches(columnsByName, "checksum_sha256", "text", "NO") &&
    columnMatches(columnsByName, "provenance", "text", "NO") &&
    columnMatches(
      columnsByName,
      "applied_at",
      "timestamp with time zone",
      "YES",
    ) &&
    columnMatches(
      columnsByName,
      "recorded_at",
      "timestamp with time zone",
      "NO",
    ) &&
    columnMatches(columnsByName, "recorded_by", "text", "NO") &&
    columnMatches(columnsByName, "reconciliation_reference", "text", "YES");

  const rows = await sql<JsonLedgerRow[]>`
    select pg_catalog.to_jsonb(migration) as record
    from public.schema_migrations migration
    order by migration.filename
  `;

  const constraints = await sql<CatalogConstraint[]>`
    select constraint_row.conname as "constraintName",
           constraint_row.convalidated as validated
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.schema_migrations'::regclass
    order by constraint_row.conname
  `;
  const constraintNames = constraints
    .filter((constraint) => constraint.validated)
    .map((constraint) => constraint.constraintName);

  if (legacy && exactSet(constraintNames, ["schema_migrations_pkey"])) {
    return {
      shape: "legacy",
      immutable: false,
      rows: rows.map((row) => normalizeLedgerRow(row.record)),
    };
  }
  if (legacyNames && !legacy) {
    return {
      shape: "unsupported",
      immutable: false,
      rows: rows.map((row) => normalizeLedgerRow(row.record)),
      details:
        "schema_migrations resembles the legacy ledger but its column contract differs",
    };
  }
  if (!governed) {
    return {
      shape: "unsupported",
      immutable: false,
      rows: rows.map((row) => normalizeLedgerRow(row.record)),
      details: `schema_migrations has unsupported columns: ${columnNames.join(", ")}`,
    };
  }

  const triggers = await sql<CatalogTrigger[]>`
    select trigger_row.tgname as "triggerName", trigger_row.tgenabled as enabled
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.schema_migrations'::regclass
      and not trigger_row.tgisinternal
    order by trigger_row.tgname
  `;
  const indexes = await sql<CatalogIndex[]>`
    select index_relation.relname as "indexName",
           index_definition.indisunique as unique,
           index_definition.indisvalid as valid,
           pg_catalog.pg_get_expr(
             index_definition.indpred,
             index_definition.indrelid
           ) as predicate
    from pg_catalog.pg_index index_definition
    join pg_catalog.pg_class index_relation
      on index_relation.oid = index_definition.indexrelid
    where index_definition.indrelid = 'public.schema_migrations'::regclass
    order by index_relation.relname
  `;

  const enabledTriggerNames = triggers
    .filter((trigger) => trigger.enabled !== "D")
    .map((trigger) => trigger.triggerName);
  const versionIndex = indexes.find(
    (index) => index.indexName === governedVersionIndex,
  );

  return {
    shape: "governed",
    immutable:
      exactSet(constraintNames, governedConstraints) &&
      exactSet(enabledTriggerNames, immutabilityTriggers) &&
      versionIndex?.unique === true &&
      versionIndex.valid === true &&
      /version\s*<>\s*46/.test(versionIndex.predicate ?? ""),
    rows: rows.map((row) => normalizeLedgerRow(row.record)),
  };
}

export async function createGovernedMigrationLedger(
  transaction: TransactionSql,
) {
  const snapshot = await readMigrationLedgerSnapshot(transaction);
  if (snapshot.shape !== "absent" || snapshot.details) {
    throw new Error(
      `Cannot create governed ledger over ${snapshot.shape} ledger state. ${snapshot.details ?? ""}`,
    );
  }
  await transaction.unsafe(GOVERNED_MIGRATION_LEDGER_DDL);
  const created = await readMigrationLedgerSnapshot(transaction);
  if (created.shape !== "governed" || !created.immutable) {
    throw new Error(
      "Governed migration ledger creation did not pass its own attestation.",
    );
  }
}

export async function initializeLegacyMigrationLedger(
  transaction: TransactionSql,
  inventory: readonly MigrationDefinition[],
  reference: string,
) {
  const snapshot = await readMigrationLedgerSnapshot(transaction);
  if (snapshot.shape !== "legacy") {
    throw new Error(
      `Ledger initialization requires exact legacy shape, found ${snapshot.shape}.`,
    );
  }

  const plan = buildMigrationPlan(inventory, snapshot);
  const unexpected = plan.errors.filter(
    (error) =>
      error !==
      "Legacy filename-only ledger requires explicit governance initialization.",
  );
  if (unexpected.length) {
    throw new Error(
      `Legacy ledger cannot be initialized: ${unexpected.join(" ")}`,
    );
  }

  await transaction.unsafe(LEGACY_LEDGER_UPGRADE_PREFIX);
  const applied = new Set(snapshot.rows.map((row) => row.filename));
  for (const migration of inventory) {
    if (!applied.has(migration.filename)) continue;
    await transaction`
      update public.schema_migrations
      set version = ${migration.version},
          migration_order = ${migration.migrationOrder},
          checksum_sha256 = ${migration.checksumSha256},
          provenance = 'legacy_filename_record',
          recorded_at = transaction_timestamp(),
          recorded_by = current_user,
          reconciliation_reference = ${reference}
      where filename = ${migration.filename}
    `;
  }
  await transaction.unsafe(LEGACY_LEDGER_UPGRADE_SUFFIX);

  const initialized = await readMigrationLedgerSnapshot(transaction);
  const initializedPlan = buildMigrationPlan(inventory, initialized);
  if (
    initialized.shape !== "governed" ||
    !initialized.immutable ||
    initializedPlan.errors.length
  ) {
    throw new Error(
      `Legacy ledger initialization failed attestation: ${initializedPlan.errors.join(" ")}`,
    );
  }
}

export async function insertAtomicMigrationRecord(
  transaction: TransactionSql,
  migration: MigrationDefinition,
) {
  await transaction`
    insert into public.schema_migrations (
      filename,
      version,
      migration_order,
      checksum_sha256,
      provenance,
      applied_at,
      recorded_at,
      recorded_by,
      reconciliation_reference
    ) values (
      ${migration.filename},
      ${migration.version},
      ${migration.migrationOrder},
      ${migration.checksumSha256},
      'runner_atomic',
      transaction_timestamp(),
      transaction_timestamp(),
      current_user,
      null
    )
  `;
}

export async function insertReconciledMigrationRecord(
  transaction: TransactionSql,
  migration: MigrationDefinition,
  reference: string,
) {
  await transaction`
    insert into public.schema_migrations (
      filename,
      version,
      migration_order,
      checksum_sha256,
      provenance,
      applied_at,
      recorded_at,
      recorded_by,
      reconciliation_reference
    ) values (
      ${migration.filename},
      ${migration.version},
      ${migration.migrationOrder},
      ${migration.checksumSha256},
      'schema_effect_reconciliation',
      null,
      transaction_timestamp(),
      current_user,
      ${reference}
    )
  `;
}

export async function readMigrationColumnEvidence(
  transaction: TransactionSql,
  filename: string,
): Promise<readonly MigrationColumnEvidence[]> {
  const expected = reconciliationColumns(filename);
  const tupleSql = expected
    .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
    .join(", ");
  const parameters = expected.flatMap((column) => [
    column.tableName,
    column.columnName,
  ]);
  return transaction.unsafe<MigrationColumnEvidence[]>(
    `
    select
      column_info.table_name as "tableName",
      column_info.column_name as "columnName",
      column_info.data_type as "dataType",
      column_info.numeric_precision as "numericPrecision",
      column_info.numeric_scale as "numericScale",
      column_info.is_generated as "isGenerated",
      column_info.generation_expression as "generationExpression"
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and (column_info.table_name, column_info.column_name) in (${tupleSql})
    order by column_info.table_name, column_info.column_name
  `,
    parameters,
  );
}
