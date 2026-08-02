import assert from 'node:assert/strict';
import test from 'node:test';
import postgres from 'postgres';
import { correctObservationDecision } from '@/lib/moderation/database-transitions';

const databaseUrl = process.env.MODERATION_CONCURRENCY_TEST_DATABASE_URL;
const writeEnabled = process.env.MODERATION_CONCURRENCY_TEST_ALLOW_WRITE === '1';
const runIntegration = Boolean(databaseUrl && writeEnabled);

const operatorId = '8e743756-f435-4ad8-854f-b1c62d445ba6';
const operatorSubject = 'jelocare-integration|observation-correction';
const draftId = 'd5835310-2a0c-428f-914a-cc5197450755';
const contributionId = '246371a4-891d-4725-ab64-57bc9e2e5240';
const observationId = 'a361540c-45c3-4c75-90b2-462f5924f17a';
const applicationNames = [
  'jelocare-observation-correction-a',
  'jelocare-observation-correction-b',
];

function client(applicationName: string) {
  return postgres(databaseUrl!, {
    max: 1,
    prepare: false,
    connection: { application_name: applicationName },
  });
}

async function waitForBothCorrectionWritersToBlock(
  observer: ReturnType<typeof postgres>,
) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [row] = await observer<{ blocked: number }[]>`
      select count(*)::int as blocked
      from pg_stat_activity
      where application_name in (${applicationNames[0]}, ${applicationNames[1]})
        and wait_event_type = 'Lock'
    `;
    if (row?.blocked === 2) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Both correction clients did not reach the observation row-lock barrier.');
}

test('overlapping observation corrections serialize and append one causal event', {
  skip: runIntegration
    ? false
    : 'requires an explicitly writable disposable MODERATION_CONCURRENCY_TEST_DATABASE_URL',
  timeout: 30_000,
}, async () => {
  const setup = client('jelocare-observation-correction-setup');
  const barrier = client('jelocare-observation-correction-barrier');
  const first = client(applicationNames[0]);
  const second = client(applicationNames[1]);
  const barrierControl: { release?: () => void } = {};

  try {
    await setup.begin(async tx => {
      await tx`
        delete from moderation_audit_log
        where queue = 'community_observation' and target_ref = ${observationId}
      `;
      await tx`delete from community_observations where id = ${observationId}`;
      await tx`delete from community_contributions where id = ${contributionId}`;
      await tx`delete from community_intake_drafts where id = ${draftId}`;
      await tx`delete from moderation_operators where id = ${operatorId}`;

      await tx`
        insert into moderation_operators (
          id, auth_subject, display_name, role, active
        ) values (
          ${operatorId}, ${operatorSubject},
          'Disposable correction concurrency test', 'admin', true
        )
      `;
      await tx`
        insert into community_intake_drafts (
          id, edit_secret_hash, contribution_kind, payload, status,
          submitted_at, expires_at
        ) values (
          ${draftId}, ${'a'.repeat(64)}, 'product', ${tx.json({ testFixture: true })},
          'submitted', now(), now() + interval '30 days'
        )
      `;
      await tx`
        insert into community_contributions (
          id, draft_id, contribution_kind, payload, moderation_status, retain_until
        ) values (
          ${contributionId}, ${draftId}, 'product', ${tx.json({ testFixture: true })},
          'approved', now() + interval '30 days'
        )
      `;
      await tx`
        insert into community_observations (
          id, contribution_id, observation_kind, subject_kind, subject_ref,
          amount_ngn, moderation_status
        ) values (
          ${observationId}, ${contributionId}, 'price', 'product',
          'product:disposable-correction-test', 100, 'approved'
        )
      `;
      await tx`
        insert into moderation_audit_log (
          operator_subject, queue, action, target_ref, canonical_write,
          rationale, metadata
        ) values (
          ${operatorSubject}, 'community_observation', 'approve', ${observationId},
          false, 'Synthetic starting state for the disposable concurrency rehearsal.',
          ${tx.json({ integrationTest: true })}
        )
      `;
    });

    let markBarrierReady!: () => void;
    const barrierReady = new Promise<void>(resolve => {
      markBarrierReady = resolve;
    });
    const holdBarrier = new Promise<void>(resolve => {
      barrierControl.release = resolve;
    });
    const barrierTransaction = barrier.begin(async tx => {
      await tx`select id from community_observations where id = ${observationId} for update`;
      markBarrierReady();
      await holdBarrier;
    });
    await barrierReady;

    const attempts = [first, second].map((sql, index) => correctObservationDecision(
      sql,
      operatorSubject,
      observationId,
      'defer',
      `Disposable overlapping correction attempt ${index + 1}.`,
    ));

    await waitForBothCorrectionWritersToBlock(setup);
    assert.ok(barrierControl.release);
    barrierControl.release();
    delete barrierControl.release;
    await barrierTransaction;

    const results = await Promise.allSettled(attempts);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    const rejection = results.find(result => result.status === 'rejected');
    assert.match(String(rejection && rejection.status === 'rejected' ? rejection.reason : ''), /pending observation/);

    const [observation] = await setup<{ moderation_status: string }[]>`
      select moderation_status
      from community_observations
      where id = ${observationId}
    `;
    const events = await setup<{
      id: string;
      event_sequence: string;
      action: string;
      metadata: Record<string, unknown>;
    }[]>`
      select id, event_sequence::text as event_sequence, action, metadata
      from moderation_audit_log
      where queue = 'community_observation' and target_ref = ${observationId}
      order by event_sequence desc
    `;

    assert.equal(observation?.moderation_status, 'pending');
    assert.equal(events.length, 2);
    assert.equal(events.filter(event => event.metadata.correction === true).length, 1);
    assert.equal(events[0]?.action, 'defer');
    assert.equal(events[0]?.metadata.nextStatus, 'pending');
    assert.ok(BigInt(events[0]!.event_sequence) > BigInt(events[1]!.event_sequence));
  } finally {
    barrierControl.release?.();
    await Promise.allSettled([
      first.end(),
      second.end(),
      barrier.end(),
      setup.end(),
    ]);
  }
});
