import { createHash } from "node:crypto";

export const MIGRATION_FILENAME_PATTERN =
  /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
export const MIGRATION_CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

export const MIGRATION_LEDGER_PROVENANCES = [
  "runner_atomic",
  "legacy_filename_record",
  "schema_effect_reconciliation",
] as const;

export type MigrationLedgerProvenance =
  (typeof MIGRATION_LEDGER_PROVENANCES)[number];

export type MigrationSource = {
  filename: string;
  source: string;
};

export type MigrationDefinition = MigrationSource & {
  version: number;
  migrationOrder: number;
  checksumSha256: string;
};

export type MigrationLedgerRow = {
  filename: string;
  version?: number;
  migrationOrder?: number;
  checksumSha256?: string;
  provenance?: string;
  appliedAt?: string | null;
  recordedAt?: string;
  recordedBy?: string;
  reconciliationReference?: string | null;
};

export type MigrationLedgerSnapshot = {
  shape: "absent" | "legacy" | "governed" | "unsupported";
  immutable: boolean;
  rows: readonly MigrationLedgerRow[];
  details?: string;
};

export type MigrationPlanEntry = {
  filename: string;
  version: number;
  migrationOrder: number;
  checksumSha256: string;
  state: "applied" | "legacy" | "pending" | "drift";
  provenance?: string;
  detail?: string;
};

export type MigrationPlan = {
  ledgerShape: MigrationLedgerSnapshot["shape"];
  immutable: boolean;
  entries: readonly MigrationPlanEntry[];
  errors: readonly string[];
  canApply: boolean;
};

type ReconciliationColumnExpectation = {
  tableName: string;
  columnName: string;
  generated?: boolean;
};

export type MigrationColumnEvidence = {
  tableName: string;
  columnName: string;
  dataType: string;
  numericPrecision: number | string | null;
  numericScale: number | string | null;
  isGenerated: string;
  generationExpression: string | null;
};

const historicalDuplicateVersion = 46;
const historicalDuplicateEntries = [
  {
    filename: "0046_fix_customer_request_signal_bridge.sql",
    checksumSha256:
      "fcccf32b889ce18ce3ed84568427c919787f5cb66a646b324f8d2d9cdbdadc59",
  },
  {
    filename: "0046_service_fee_policies.sql",
    checksumSha256:
      "158d6b84f220348f929aa1b9d3ca0d09bdcd151ca96e52d2932a487fe14e6d41",
  },
] as const;

const reconciliationExpectations = new Map<
  string,
  readonly ReconciliationColumnExpectation[]
>([
  [
    "0048_money_columns_to_numeric.sql",
    [
      {
        tableName: "assisted_order_lines",
        columnName: "observed_unit_price_ngn",
      },
      {
        tableName: "assisted_order_quotes",
        columnName: "product_subtotal_ngn",
      },
      { tableName: "assisted_order_quotes", columnName: "retailer_fee_ngn" },
      { tableName: "assisted_order_quotes", columnName: "tax_ngn" },
      { tableName: "assisted_order_quotes", columnName: "jelocare_fee_ngn" },
      { tableName: "assisted_order_quotes", columnName: "delivery_ngn" },
      {
        tableName: "assisted_order_quotes",
        columnName: "total_ngn",
        generated: true,
      },
      {
        tableName: "assisted_order_line_verifications",
        columnName: "verified_unit_price_ngn",
      },
      {
        tableName: "assisted_order_line_verifications",
        columnName: "verified_product_subtotal_ngn",
      },
      {
        tableName: "assisted_order_line_verifications",
        columnName: "verified_delivery_ngn",
      },
      {
        tableName: "assisted_order_line_verifications",
        columnName: "verified_tax_ngn",
      },
      {
        tableName: "assisted_order_line_verifications",
        columnName: "verified_retailer_fee_ngn",
      },
      {
        tableName: "assisted_order_line_verifications",
        columnName: "verified_total_ngn",
      },
      { tableName: "assisted_order_payments", columnName: "amount_ngn" },
      { tableName: "service_fee_policies", columnName: "flat_fee_ngn" },
      { tableName: "service_fee_policies", columnName: "min_fee_ngn" },
      { tableName: "service_fee_policies", columnName: "max_fee_ngn" },
      {
        tableName: "assisted_order_quotes",
        columnName: "service_fee_policy_resolved_ngn",
      },
    ],
  ],
  [
    "0049_fix_remaining_money_columns.sql",
    [
      { tableName: "commerce_events", columnName: "price_ngn" },
      { tableName: "community_observations", columnName: "amount_ngn" },
    ],
  ],
]);

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function migrationBytesSha256(source: string | Uint8Array) {
  return createHash("sha256").update(source).digest("hex");
}

export function parseMigrationFilename(filename: string) {
  const match = MIGRATION_FILENAME_PATTERN.exec(filename);
  if (!match) {
    throw new Error(
      `${filename} must match NNNN_lower_snake_case.sql with a four-digit positive version.`,
    );
  }

  const version = Number(match[1]);
  if (!positiveInteger(version))
    throw new Error(`${filename} must use a positive version.`);
  return { version, name: match[2]! };
}

export function buildMigrationInventory(
  sources: readonly MigrationSource[],
): readonly MigrationDefinition[] {
  if (sources.length === 0)
    throw new Error("At least one migration is required.");

  const filenames = new Set<string>();
  const parsed = sources
    .map((item) => {
      if (filenames.has(item.filename)) {
        throw new Error(
          `Migration filename ${item.filename} appears more than once.`,
        );
      }
      filenames.add(item.filename);
      const { version } = parseMigrationFilename(item.filename);
      return {
        ...item,
        version,
        checksumSha256: migrationBytesSha256(item.source),
      };
    })
    .sort((left, right) => compareText(left.filename, right.filename));

  const groups = new Map<number, typeof parsed>();
  for (const migration of parsed) {
    const group = groups.get(migration.version) ?? [];
    group.push(migration);
    groups.set(migration.version, group);
  }

  let expectedVersion = 1;
  for (const [version, group] of [...groups].sort(
    ([left], [right]) => left - right,
  )) {
    if (version !== expectedVersion) {
      throw new Error(
        `Migration versions must be contiguous: expected ${String(expectedVersion).padStart(4, "0")}, found ${String(version).padStart(4, "0")}.`,
      );
    }

    if (group.length > 1) {
      const exactHistoricalException =
        version === historicalDuplicateVersion &&
        group.length === historicalDuplicateEntries.length &&
        historicalDuplicateEntries.every((expected, index) => {
          const actual = group[index];
          return (
            actual?.filename === expected.filename &&
            actual.checksumSha256 === expected.checksumSha256
          );
        });
      if (!exactHistoricalException) {
        throw new Error(
          `Migration version ${String(version).padStart(4, "0")} is duplicated; only the digest-pinned historical 0046 pair is accepted.`,
        );
      }
    }

    expectedVersion += 1;
  }

  return parsed.map((migration, index) => ({
    ...migration,
    migrationOrder: index + 1,
  }));
}

export function assertMigrationMatchesDefinition(
  definition: MigrationDefinition,
  source: string,
) {
  const actual = migrationBytesSha256(source);
  if (actual !== definition.checksumSha256) {
    throw new Error(
      `${definition.filename} changed after planning: expected ${definition.checksumSha256}, found ${actual}.`,
    );
  }
}

function governedRowDrift(
  migration: MigrationDefinition,
  row: MigrationLedgerRow,
): string | undefined {
  if (row.version !== migration.version) {
    return `version is ${String(row.version)}, expected ${migration.version}`;
  }
  if (row.migrationOrder !== migration.migrationOrder) {
    return `order is ${String(row.migrationOrder)}, expected ${migration.migrationOrder}`;
  }
  if (row.checksumSha256 !== migration.checksumSha256) {
    return `checksum is ${String(row.checksumSha256)}, expected ${migration.checksumSha256}`;
  }
  if (
    !MIGRATION_LEDGER_PROVENANCES.includes(
      row.provenance as MigrationLedgerProvenance,
    )
  ) {
    return `provenance ${String(row.provenance)} is unsupported`;
  }
  if (!row.recordedAt || !row.recordedBy) {
    return "recording provenance is incomplete";
  }
  if (row.provenance === "runner_atomic") {
    if (!row.appliedAt || row.reconciliationReference) {
      return "atomic-run provenance fields are inconsistent";
    }
  } else if (!row.reconciliationReference) {
    return "legacy or reconciliation provenance requires an operator reference";
  } else if (
    row.provenance === "schema_effect_reconciliation" &&
    row.appliedAt
  ) {
    return "effects-only reconciliation must not claim an execution timestamp";
  }
  return undefined;
}

export function buildMigrationPlan(
  inventory: readonly MigrationDefinition[],
  snapshot: MigrationLedgerSnapshot,
): MigrationPlan {
  const errors: string[] = [];
  const rowsByFilename = new Map<string, MigrationLedgerRow>();
  for (const row of snapshot.rows) {
    if (rowsByFilename.has(row.filename)) {
      errors.push(`Ledger contains duplicate filename ${row.filename}.`);
    }
    rowsByFilename.set(row.filename, row);
  }

  const inventoryNames = new Set(
    inventory.map((migration) => migration.filename),
  );
  for (const row of snapshot.rows) {
    if (!inventoryNames.has(row.filename)) {
      errors.push(`Ledger contains unknown migration ${row.filename}.`);
    }
  }

  if (snapshot.shape === "unsupported") {
    errors.push(snapshot.details ?? "Migration ledger shape is unsupported.");
  }
  if (snapshot.shape === "absent" && snapshot.details) {
    errors.push(snapshot.details);
  }
  if (snapshot.shape === "legacy") {
    errors.push(
      "Legacy filename-only ledger requires explicit governance initialization.",
    );
  }
  if (snapshot.shape === "governed" && !snapshot.immutable) {
    errors.push(
      "Governed migration ledger is missing its immutable update/delete/truncate guards.",
    );
  }

  let pendingSeen = false;
  const entries = inventory.map((migration) => {
    const row = rowsByFilename.get(migration.filename);
    if (!row) {
      pendingSeen = true;
      return {
        filename: migration.filename,
        version: migration.version,
        migrationOrder: migration.migrationOrder,
        checksumSha256: migration.checksumSha256,
        state: "pending" as const,
      };
    }

    if (pendingSeen) {
      const detail = "ledgered after an earlier pending migration";
      errors.push(`${migration.filename}: ${detail}.`);
      return {
        filename: migration.filename,
        version: migration.version,
        migrationOrder: migration.migrationOrder,
        checksumSha256: migration.checksumSha256,
        state: "drift" as const,
        provenance: row.provenance,
        detail,
      };
    }

    if (snapshot.shape === "legacy") {
      return {
        filename: migration.filename,
        version: migration.version,
        migrationOrder: migration.migrationOrder,
        checksumSha256: migration.checksumSha256,
        state: "legacy" as const,
        detail: "filename recorded; executed-byte checksum is not attested",
      };
    }

    if (snapshot.shape !== "governed") {
      const detail = `row is incompatible with ${snapshot.shape} ledger state`;
      errors.push(`${migration.filename}: ${detail}.`);
      return {
        filename: migration.filename,
        version: migration.version,
        migrationOrder: migration.migrationOrder,
        checksumSha256: migration.checksumSha256,
        state: "drift" as const,
        detail,
      };
    }

    const detail = governedRowDrift(migration, row);
    if (detail) {
      errors.push(`${migration.filename}: ${detail}.`);
      return {
        filename: migration.filename,
        version: migration.version,
        migrationOrder: migration.migrationOrder,
        checksumSha256: migration.checksumSha256,
        state: "drift" as const,
        provenance: row.provenance,
        detail,
      };
    }

    return {
      filename: migration.filename,
      version: migration.version,
      migrationOrder: migration.migrationOrder,
      checksumSha256: migration.checksumSha256,
      state: "applied" as const,
      provenance: row.provenance,
    };
  });

  return {
    ledgerShape: snapshot.shape,
    immutable: snapshot.immutable,
    entries,
    errors,
    canApply:
      (snapshot.shape === "absent" || snapshot.shape === "governed") &&
      errors.length === 0,
  };
}

export function requireOperatorReference(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,119}$/.test(candidate)) {
    throw new Error(
      "An operator reference of 3-120 safe identifier characters is required.",
    );
  }
  return candidate;
}

export function reconciliationColumns(filename: string) {
  const expectations = reconciliationExpectations.get(filename);
  if (!expectations) {
    throw new Error(
      `${filename} has no checked-in schema-effect reconciliation contract.`,
    );
  }
  return expectations;
}

function evidenceKey(tableName: string, columnName: string) {
  return `${tableName}.${columnName}`;
}

export function assertMigrationReconciliationEvidence(
  filename: string,
  evidence: readonly MigrationColumnEvidence[],
) {
  const expectations = reconciliationColumns(filename);
  const evidenceByKey = new Map<string, MigrationColumnEvidence>();
  for (const row of evidence) {
    const key = evidenceKey(row.tableName, row.columnName);
    if (evidenceByKey.has(key))
      throw new Error(`${filename}: duplicate catalog evidence for ${key}.`);
    evidenceByKey.set(key, row);
  }

  for (const expected of expectations) {
    const key = evidenceKey(expected.tableName, expected.columnName);
    const actual = evidenceByKey.get(key);
    if (!actual)
      throw new Error(`${filename}: required schema effect ${key} is absent.`);
    if (
      actual.dataType !== "numeric" ||
      Number(actual.numericPrecision) !== 12 ||
      Number(actual.numericScale) !== 2
    ) {
      throw new Error(`${filename}: ${key} is not numeric(12,2).`);
    }

    const generated = actual.isGenerated.toUpperCase() === "ALWAYS";
    if (generated !== Boolean(expected.generated)) {
      throw new Error(
        `${filename}: ${key} generated-column state does not match the migration.`,
      );
    }
    if (expected.generated) {
      const expression = (actual.generationExpression ?? "")
        .toLowerCase()
        .replace(/[\s()"]+/g, "");
      const expectedExpression = [
        "product_subtotal_ngn",
        "retailer_fee_ngn",
        "tax_ngn",
        "jelocare_fee_ngn",
        "delivery_ngn",
      ].join("+");
      if (expression !== expectedExpression) {
        throw new Error(
          `${filename}: ${key} generation expression does not match the canonical five-component total.`,
        );
      }
    }
  }

  if (evidenceByKey.size !== expectations.length) {
    throw new Error(
      `${filename}: catalog evidence contains unexpected columns.`,
    );
  }
}
