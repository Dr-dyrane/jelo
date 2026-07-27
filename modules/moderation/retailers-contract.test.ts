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

test('retailer applications are oldest-first and continue beyond the initial server window', async () => {
  const [page, queues, inbox, actions, migration] = await Promise.all([
    readSource('app/(ops)/ops/retailers/page.tsx'),
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/retailers/RetailersInbox.tsx'),
    readSource('app/(ops)/ops/retailers/actions.ts'),
    readSource('db/migrations/0026_retailer_application_fifo_index.sql'),
  ]);
  const queue = sourceBetween(
    queues,
    'export async function listPendingRetailerApplications',
    'export async function findPendingRetailerApplication',
  );

  assert.match(queues, /export type PendingRetailerApplicationCursor = \{[\s\S]*?submittedAt: string;[\s\S]*?id: string;/);
  assert.match(
    queue,
    /\(application\.submitted_at,\s*application\.id\)\s*>\s*\([\s\S]*?\$\{after\.submittedAt\}::text::timestamptz,[\s\S]*?\$\{after\.id\}::uuid/,
  );
  assert.match(queue, /order by application\.submitted_at asc,\s*application\.id asc/);
  assert.doesNotMatch(queue, /\boffset\b|order by updated_at desc/i);
  assert.match(
    migration,
    /create index if not exists retailer_partnership_queue_fifo_idx[\s\S]*?on retailer_partnership_applications \(status, submitted_at asc, id asc\)/,
  );
  assert.match(migration, /where submitted_at is not null/);
  assert.doesNotMatch(migration, /\bdrop\b|\bdelete\b|\bupdate\b/i);

  assert.match(page, /listPendingRetailerApplications\(sql,\s*LIMIT \+ 1\)/);
  assert.match(page, /fetchedRows\.slice\(0,\s*LIMIT\)/);
  assert.match(page, /fetchedRows\.length > LIMIT/);
  assert.match(page, /includeSelectedQueueItem\(/);
  assert.match(page, /findPendingRetailerApplication/);
  assert.match(page, /initialHasMore=\{hasMore\}/);
  assert.match(page, /initialCursor=\{nextCursor\}/);

  assert.match(actions, /export async function fetchMoreRetailerApplicationsAction/);
  assert.match(actions, /await requireConsoleOperator\(\)/);
  assert.match(actions, /listPendingRetailerApplications\([\s\S]*?safeLimit \+ 1,[\s\S]*?submittedAt:[\s\S]*?id:/);
  assert.match(actions, /submittedAt: afterSubmittedAt/);
  assert.doesNotMatch(actions, /submittedAt: parsedDate\.toISOString\(\)/);
  assert.match(actions, /Number\.isFinite\(limit\) \? Math\.trunc\(limit\) : 40/);
  assert.match(inbox, /fetchMoreRetailerApplicationsAction\(/);
  assert.match(inbox, /left\.submittedAt < right\.submittedAt \? -1 : 1/);
  assert.doesNotMatch(inbox, /new Date\(left\.submittedAt\)/);
  assert.match(inbox, /left\.id < right\.id \? -1 : 1/);
  assert.doesNotMatch(inbox, /left\.id\.localeCompare/);
  assert.match(inbox, /settled\.has\(row\.id\) \|\| knownIds\.has\(row\.id\)/);
  assert.match(inbox, /new IntersectionObserver/);
  assert.match(inbox, /root: document\.querySelector<HTMLElement>\('\[data-ops-main\]'\)/);
  assert.match(inbox, /ref=\{loadSentinelRef\}/);
  assert.match(inbox, /:\s*'Load more'/);
  assert.doesNotMatch(`${page}\n${inbox}`, /most recent|more may be pending/i);
});

test('retailer continuation preserves selection, settlement, and calm recovery', async () => {
  const inbox = await readSource('app/(ops)/ops/retailers/RetailersInbox.tsx');

  assert.match(inbox, /pendingSelectionId=\{selection\.pendingSelectionId\}/);
  assert.match(inbox, /controllerRef=\{inboxControllerRef\}/);
  assert.match(inbox, /inboxControllerRef\.current\?\.settleItem\(actionState\.targetId\)/);
  assert.match(inbox, /dispatchQueue\(\{ type: 'settled', id: actionState\.targetId \}\)/);
  assert.match(inbox, /const byId = new Map<string, RetailerApplicationReviewItem>\(\)/);
  assert.match(inbox, /loadError: 'Couldn’t load more\. Try again\.'/);
  assert.match(inbox, /title="You’re caught up\."/);
  assert.match(inbox, /action=\{\{ href: '\/ops\/activity', label: 'View insights' \}\}/);
  assert.match(inbox, /role="alert"/);
  assert.match(inbox, /role="status" aria-live="polite"/);
});
