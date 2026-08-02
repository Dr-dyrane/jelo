import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  applyMigrationAtomically,
  type MigrationTransactionRunner,
  unwrapMigrationTransaction,
} from '../../lib/database/migration-runner';

const root = process.cwd();

test('every checked-in migration has one strict outer transaction wrapper', async () => {
  const directory = path.join(root, 'db', 'migrations');
  const files = (await readdir(directory)).filter(file => file.endsWith('.sql')).sort();

  assert.ok(files.length > 0);
  for (const filename of files) {
    const source = await readFile(path.join(directory, filename), 'utf8');
    const body = unwrapMigrationTransaction(source, filename);
    assert.doesNotMatch(body, /^\s*(?:begin|start\s+transaction|commit|rollback)\s*;\s*$/im);
  }
});

test('migration body and ledger row roll back together when recording fails', async () => {
  const state = { bodyApplied: false, ledger: new Set<string>() };
  let failRecord = true;

  const runner: MigrationTransactionRunner = {
    async begin(work) {
      const pending = { bodyApplied: state.bodyApplied, ledger: new Set(state.ledger) };
      await work({
        async unsafe(source) {
          assert.match(source, /add constraint/);
          pending.bodyApplied = true;
        },
        async record(filename) {
          if (failRecord) throw new Error('simulated cancellation before ledger insert');
          pending.ledger.add(filename);
        },
      });
      state.bodyApplied = pending.bodyApplied;
      state.ledger = pending.ledger;
    },
  };

  const source = 'begin;\nalter table example add constraint example_check check (true);\ncommit;';
  await assert.rejects(
    applyMigrationAtomically(runner, '0031_example.sql', source),
    /simulated cancellation/,
  );
  assert.equal(state.bodyApplied, false);
  assert.equal(state.ledger.has('0031_example.sql'), false);

  failRecord = false;
  await applyMigrationAtomically(runner, '0031_example.sql', source);
  assert.equal(state.bodyApplied, true);
  assert.equal(state.ledger.has('0031_example.sql'), true);
});

test('migration wrapper rejects missing, nested, and empty transactions', () => {
  assert.throws(
    () => unwrapMigrationTransaction('alter table example add column value text;', 'missing.sql'),
    /exactly one outer/,
  );
  assert.throws(
    () => unwrapMigrationTransaction('begin;\nbegin;\nselect 1;\ncommit;\ncommit;', 'nested.sql'),
    /nested transaction control/,
  );
  assert.throws(
    () => unwrapMigrationTransaction('begin;\ncommit;', 'empty.sql'),
    /empty migration body/,
  );
});
