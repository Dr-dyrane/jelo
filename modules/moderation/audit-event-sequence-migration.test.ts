import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

async function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('0032 adds and backfills a non-null database-owned moderation event sequence', async () => {
  const migration = await readSource('db/migrations/0032_moderation_audit_event_sequence.sql');

  assert.match(migration, /^begin;/);
  assert.match(migration, /create sequence moderation_audit_log_event_sequence_seq as bigint/);
  assert.match(migration, /add column event_sequence bigint/);
  assert.match(migration, /row_number\(\) over \(order by created_at asc, id asc\)::bigint/);
  assert.match(migration, /setval\([\s\S]*?max\(event_sequence\)[\s\S]*?false/);
  assert.match(migration, /alter column event_sequence set default nextval/);
  assert.match(migration, /alter column event_sequence set not null/);
  assert.match(migration, /moderation_audit_log_event_sequence_key unique \(event_sequence\)/);
  assert.match(
    migration,
    /moderation_audit_log_target_sequence_idx[\s\S]*?\(queue, target_ref, event_sequence desc\)/,
  );
  assert.match(migration, /commit;\s*$/);
});

test('causal moderation reads use event_sequence while timestamps remain presentation data', async () => {
  const [transitions, auditQueries, activity, operators, sidebar] = await Promise.all([
    readSource('lib/moderation/database-transitions.ts'),
    readSource('lib/moderation/audit-queries.ts'),
    readSource('lib/moderation/activity-read-model.ts'),
    readSource('lib/moderation/operators.ts'),
    readSource('lib/moderation/sidebar-summary.ts'),
  ]);

  assert.match(transitions, /order by event_sequence desc/);
  assert.doesNotMatch(transitions, /order by created_at desc, id desc/);
  assert.match(auditQueries, /order by audit\.event_sequence desc/);
  assert.match(activity, /order by audit\.event_sequence desc/);
  assert.match(operators, /order by audit\.event_sequence desc/);
  assert.match(sidebar, /array_agg\(created_at order by event_sequence desc\)/);
});

test('the original audit table migration remains immutable', async () => {
  const original = await readSource('db/migrations/0020_moderation_operations.sql');
  assert.doesNotMatch(original, /event_sequence/);
  assert.match(original, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(original, /created_at timestamptz not null default now\(\)/);
});
