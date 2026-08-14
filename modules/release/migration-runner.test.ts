import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  applyMigrationAtomically,
  type MigrationTransactionRunner,
  unwrapMigrationTransaction,
} from "../../lib/database/migration-runner";
import { migrationBytesSha256 } from "../../lib/database/migration-governance";

const root = process.cwd();

function migrationDefinition(filename: string, source: string) {
  const version = Number(filename.slice(0, 4));
  return {
    filename,
    source,
    version,
    migrationOrder: version,
    checksumSha256: migrationBytesSha256(source),
  };
}

test("every checked-in migration has one strict outer transaction wrapper", async () => {
  const directory = path.join(root, "db", "migrations");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.ok(files.length > 0);
  for (const filename of files) {
    const source = await readFile(path.join(directory, filename), "utf8");
    const body = unwrapMigrationTransaction(source, filename);
    assert.doesNotMatch(
      body,
      /^\s*(?:begin|start\s+transaction|commit|rollback)\s*;\s*$/im,
    );
  }
});

test("migration body and ledger row roll back together when recording fails", async () => {
  const state = { bodyApplied: false, ledger: new Set<string>() };
  let failRecord = true;

  const runner: MigrationTransactionRunner = {
    async begin(work) {
      const pending = {
        bodyApplied: state.bodyApplied,
        ledger: new Set(state.ledger),
      };
      await work({
        async unsafe(source) {
          assert.match(source, /add constraint/);
          pending.bodyApplied = true;
        },
        async record(migration) {
          if (failRecord)
            throw new Error("simulated cancellation before ledger insert");
          pending.ledger.add(migration.filename);
        },
      });
      state.bodyApplied = pending.bodyApplied;
      state.ledger = pending.ledger;
    },
  };

  const source =
    "begin;\nalter table example add constraint example_check check (true);\ncommit;";
  const migration = migrationDefinition("0031_example.sql", source);
  await assert.rejects(
    applyMigrationAtomically(runner, migration, source),
    /simulated cancellation/,
  );
  assert.equal(state.bodyApplied, false);
  assert.equal(state.ledger.has("0031_example.sql"), false);

  failRecord = false;
  await applyMigrationAtomically(runner, migration, source);
  assert.equal(state.bodyApplied, true);
  assert.equal(state.ledger.has("0031_example.sql"), true);
});

test("atomic application rejects bytes changed after the migration plan", async () => {
  const source = "begin;\nselect 1;\ncommit;";
  const migration = migrationDefinition("0031_example.sql", source);
  const runner: MigrationTransactionRunner = {
    async begin() {
      assert.fail("transaction must not open for changed bytes");
    },
  };
  await assert.rejects(
    applyMigrationAtomically(runner, migration, `${source}\n-- changed`),
    /changed after planning/,
  );
});

test("migration wrapper rejects missing, nested, and empty transactions", () => {
  assert.throws(
    () =>
      unwrapMigrationTransaction(
        "alter table example add column value text;",
        "missing.sql",
      ),
    /exactly one outer/,
  );
  assert.throws(
    () =>
      unwrapMigrationTransaction(
        "begin;\nbegin;\nselect 1;\ncommit;\ncommit;",
        "nested.sql",
      ),
    /nested transaction control/,
  );
  assert.throws(
    () => unwrapMigrationTransaction("begin;\ncommit;", "empty.sql"),
    /empty migration body/,
  );
});

test("migration wrapper rejects inline transaction-control escapes", () => {
  for (const control of [
    "commit",
    "rollback",
    "abort",
    "savepoint unsafe",
    "release savepoint unsafe",
    "prepare transaction 'unsafe'",
    "start transaction",
    "end",
  ]) {
    assert.throws(
      () =>
        unwrapMigrationTransaction(
          `begin;\ncreate table example(id integer); ${control};\nselect 1;\ncommit;`,
          "inline-control.sql",
        ),
      /nested transaction control/,
      control,
    );
  }
});

test("migration wrapper ignores transaction words inside SQL literals and comments", () => {
  const source = String.raw`begin;
select 'commit;', E'rollback;\'still text', "begin;";
-- commit;
/* rollback; /* savepoint nested; */ commit; */
do $migration_body$
begin
  perform 'commit;';
end;
$migration_body$;
commit;`;

  const body = unwrapMigrationTransaction(source, "quoted-control.sql");
  assert.match(body, /do \$migration_body\$/);
});

test("migration wrapper rejects unterminated lexical structures before execution", () => {
  for (const body of [
    "select 'unterminated;",
    'select "unterminated;',
    "select /* unterminated;",
    "do $body$ begin end;",
  ]) {
    assert.throws(
      () =>
        unwrapMigrationTransaction(
          `begin;\n${body}\ncommit;`,
          "unterminated.sql",
        ),
      /unterminated/,
    );
  }
});
