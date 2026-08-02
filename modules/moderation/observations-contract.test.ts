import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readSource(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function sourceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected to find ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Expected to find ${end} after ${start}`);
  return source.slice(startIndex, endIndex);
}

test('the observation queue is complete, oldest-first, and keyset paginated', async () => {
  const [page, queues, actions, inbox, migration] = await Promise.all([
    readSource('app/(ops)/ops/observations/page.tsx'),
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/actions.ts'),
    readSource('app/(ops)/ops/observations/ObservationsInbox.tsx'),
    readSource('db/migrations/0028_moderation_queue_fifo_indexes.sql'),
  ]);
  const query = sourceBetween(
    queues,
    'export async function listPendingObservations',
    'export async function findPendingObservation',
  );

  assert.match(
    query,
    /\(observation\.created_at,\s*observation\.id\)\s*>\s*\([\s\S]*?\$\{after\.createdAt\}::text::timestamptz,[\s\S]*?\$\{after\.id\}::uuid/,
  );
  assert.match(query, /order by observation\.created_at asc,\s*observation\.id asc/);
  assert.match(query, /community_product_research_resolutions/);
  assert.match(query, /published_candidate\.is_published = true/);
  assert.doesNotMatch(query, /\boffset\b/i);
  assert.match(
    migration,
    /on community_observations \(moderation_status, created_at asc, id asc\)[\s\S]*?where moderation_status = 'pending'/,
  );
  assert.match(page, /listPendingObservations\(sql,\s*LIMIT \+ 1\)/);
  assert.match(page, /includeSelectedQueueItem\(/);
  assert.match(page, /findPendingObservation/);
  assert.match(page, /initialHasMore=\{hasMore\}/);
  assert.match(page, /initialCursor=\{nextCursor\}/);
  const continuation = sourceBetween(
    actions,
    'export async function fetchMoreObservationsAction',
    'export async function fetchMoreVocabularyAction',
  );
  assert.match(continuation, /Number\.isFinite\(limit\) \? Math\.trunc\(limit\) : 40/);
  assert.match(continuation, /listPendingObservations\([\s\S]*?safeLimit \+ 1,[\s\S]*?createdAt: afterCreatedAt,[\s\S]*?id:/);
  assert.doesNotMatch(continuation, /createdAt: parsedDate\.toISOString\(\)/);
  assert.match(inbox, /fetchMoreObservationsAction\(/);
  assert.match(inbox, /left\.createdAt < right\.createdAt \? -1 : 1/);
  assert.doesNotMatch(inbox, /new Date\(left\.createdAt\)/);
  assert.match(inbox, /left\.id < right\.id \? -1 : 1/);
  assert.doesNotMatch(inbox, /left\.id\.localeCompare/);
  assert.match(inbox, /settled\.has\(row\.id\) \|\| knownIds\.has\(row\.id\)/);
  assert.match(inbox, /new IntersectionObserver/);
  assert.match(inbox, /:\s*'Load more'/);
  assert.doesNotMatch(page, /most recent|more may be pending/i);
});

test('observation imagery comes only from the exact presentation projection', async () => {
  const [page, inbox, projection] = await Promise.all([
    readSource('app/(ops)/ops/observations/page.tsx'),
    readSource('app/(ops)/ops/observations/ObservationsInbox.tsx'),
    readSource('lib/moderation/observation-presentation.ts'),
  ]);

  assert.match(page, /observationReviewItem/);
  assert.match(page, /observationProductSlug/);
  assert.match(inbox, /ObservationReviewItem/);
  assert.match(inbox, /row\.identity\.image/);
  assert.match(inbox, /PackageSearch/);
  assert.match(inbox, /MessageSquareText/);
  assert.doesNotMatch(inbox, /humanizeRef|row\.product|subject\.image|product-placeholder/);
  assert.match(projection, /product\?\.slug === slug/);
  assert.match(projection, /row\.resolvedProductRef/);
  assert.match(projection, /state: slug \? 'unresolved_product' : 'non_product'/);
});

test('observation actions expose only supported audited decisions', async () => {
  const [inbox, actions, transitions] = await Promise.all([
    readSource('app/(ops)/ops/observations/ObservationsInbox.tsx'),
    readSource('app/(ops)/ops/actions.ts'),
    readSource('lib/moderation/database-transitions.ts'),
  ]);
  const observationAction = sourceBetween(
    actions,
    'export async function decideObservationAction',
    'export async function fetchMoreObservationsAction',
  );
  const observationTransition = sourceBetween(
    transitions,
    'export function decideObservation',
    'export function decideModerationValue',
  );

  assert.match(inbox, /Reject this report\?/);
  assert.match(inbox, /This removes only this report from the review queue\./);
  assert.match(inbox, /This accepts the community report only\./);
  assert.match(observationAction, /decideObservation\(/);
  assert.doesNotMatch(observationAction, /\bmap\b|\bclaim\b|\bpromote\b/);
  assert.match(observationTransition, /transition\(sql,\s*'community_observation'/);
  assert.match(transitions, /recordModerationAction\(tx,/);
});

test('settled queues and route failures preserve calm recovery paths', async () => {
  const [page, inbox, errorRoute] = await Promise.all([
    readSource('app/(ops)/ops/observations/page.tsx'),
    readSource('app/(ops)/ops/observations/ObservationsInbox.tsx'),
    readSource('app/(ops)/ops/observations/error.tsx'),
  ]);

  for (const source of [page, inbox]) {
    assert.match(source, /title="You’re caught up\."/);
    assert.match(source, /action=\{\{ href: '\/ops\/activity', label: 'View insights' \}\}/);
  }
  assert.match(errorRoute, /onRetry=\{reset\}/);
  assert.doesNotMatch(errorRoute, /\{error\.(?:message|stack)\}/);
});
