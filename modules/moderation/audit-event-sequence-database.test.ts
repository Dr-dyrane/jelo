import assert from 'node:assert/strict';
import test from 'node:test';
import postgres from 'postgres';

const databaseUrl = process.env.AUDIT_SEQUENCE_TEST_DATABASE_URL;

test('a migrated database has a complete, unique, indexed moderation event sequence', {
  skip: databaseUrl ? false : 'requires AUDIT_SEQUENCE_TEST_DATABASE_URL',
  timeout: 15_000,
}, async () => {
  const sql = postgres(databaseUrl!, { max: 1, prepare: false });
  try {
    const [ledger] = await sql<{ applied: number; transaction_id: string }[]>`
      select count(*)::int as applied, min(xmin::text) as transaction_id
      from schema_migrations
      where filename = '0032_moderation_audit_event_sequence.sql'
    `;
    const [column] = await sql<{
      is_nullable: 'YES' | 'NO';
      column_default: string | null;
    }[]>`
      select is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'moderation_audit_log'
        and column_name = 'event_sequence'
    `;
    const constraints = await sql<{ conname: string; contype: string }[]>`
      select conname, contype
      from pg_constraint
      where conrelid = 'moderation_audit_log'::regclass
        and conname = 'moderation_audit_log_event_sequence_key'
    `;
    const indexes = await sql<{ indexname: string; indexdef: string }[]>`
      select indexname, indexdef
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'moderation_audit_log'
        and indexname = 'moderation_audit_log_target_sequence_idx'
    `;
    const [integrity] = await sql<{
      total: number;
      non_null: number;
      distinct_events: number;
      maximum: string;
    }[]>`
      select
        count(*)::int as total,
        count(event_sequence)::int as non_null,
        count(distinct event_sequence)::int as distinct_events,
        coalesce(max(event_sequence), 0)::text as maximum
      from moderation_audit_log
    `;
    const [sequence] = await sql<{ last_value: string }[]>`
      select last_value::text as last_value
      from moderation_audit_log_event_sequence_seq
    `;

    assert.equal(ledger?.applied, 1);
    assert.ok(ledger?.transaction_id);
    assert.equal(column?.is_nullable, 'NO');
    assert.match(column?.column_default ?? '', /nextval\('moderation_audit_log_event_sequence_seq'/);
    assert.equal(constraints.length, 1);
    assert.equal(constraints[0]?.conname, 'moderation_audit_log_event_sequence_key');
    assert.equal(constraints[0]?.contype, 'u');
    assert.equal(indexes.length, 1);
    assert.match(indexes[0]!.indexdef, /\(queue, target_ref, event_sequence DESC\)/i);
    assert.equal(integrity?.non_null, integrity?.total);
    assert.equal(integrity?.distinct_events, integrity?.total);
    assert.ok(BigInt(sequence!.last_value) >= BigInt(integrity!.maximum));
  } finally {
    await sql.end();
  }
});
