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

test('Contributions uses the same quiet, title-only workspace header as the resolved Ops canon', async () => {
  const [workspace, page] = await Promise.all([
    readSource('components/ops/workspace/OpsWorkspace.tsx'),
    readSource('app/(ops)/ops/contributions/page.tsx'),
  ]);

  assert.doesNotMatch(workspace, /\blede\b|workspaceLede/);
  assert.doesNotMatch(page, /\blede=/);
});

test('the Contributions fallback reserves the desktop inspector without depending on URL timing', async () => {
  const loading = await readSource('app/(ops)/ops/contributions/loading.tsx');

  assert.doesNotMatch(loading, /useSearchParams|searchParams|selectedId/);
  assert.match(loading, /useSyncExternalStore/);
  assert.match(loading, /window\.matchMedia\('\(min-width: 1180px\)'\)\.matches/);
  assert.match(loading, /<DetailSkeleton \/>/);
  assert.match(loading, /createPortal\(<ContributionDetailSkeleton announce=\{false\} \/>/);
  assert.match(loading, /data-ops-reserve-detail/);

  // Compact inspectors are interaction-driven sheets in the ready state. The
  // route fallback must not invent an already-open dialog.
  assert.doesNotMatch(loading, /role="dialog"|aria-modal="true"|tabletStage/);
});

test('temporary inspectors name the selected subject and leave one evidence scroll owner', async () => {
  const [inbox, overlay, inboxCss, inspectorCss] = await Promise.all([
    readSource('components/ops/inbox/InboxContainer.tsx'),
    readSource('components/ops/shell/use-ops-overlay.ts'),
    readSource('components/ops/inbox/inbox.module.css'),
    readSource('components/ops/inbox/inbox-tablet.module.css'),
  ]);

  assert.match(inbox, /getItemLabel\?\.\(activeItem\) \?\? itemTypeLabel/);
  assert.match(inbox, /inertTargetSelectors: OPS_OVERLAY_INERT_TARGETS/);
  assert.match(overlay, /setAttribute\('inert', ''\)/);
  assert.match(overlay, /removeAttribute\('inert'\)/);
  assert.match(inboxCss, /\.detailScroll \{[\s\S]*?overflow-y: auto;/);
  assert.match(inspectorCss, /\.tabletInspectorBody \{[\s\S]*?overflow: hidden;/);
});

test('the contextual contribution action remains reachable between phone and docked layouts', async () => {
  const [chrome, shellCss] = await Promise.all([
    readSource('components/ops/shell/OpsChrome.tsx'),
    readSource('components/ops/shell/ops-tablet.module.css'),
  ]);

  assert.match(chrome, /data-ops-context-fab/);
  assert.match(
    shellCss,
    /@media \(min-width: 430px\) and \(max-width: 1179px\)[\s\S]*?\.bottomBarAction \{[\s\S]*?display: flex;[\s\S]*?width: 56px;[\s\S]*?height: 56px;/,
  );
});

test('moderation actions never return arbitrary exception text to the operator UI', async () => {
  const actions = await readSource('app/(ops)/ops/actions.ts');

  assert.doesNotMatch(
    actions,
    /return\s+\{\s*ok:\s*false[\s\S]*?error:\s*err\s+instanceof\s+Error\s*\?\s*err\.message\s*:/,
  );
  assert.doesNotMatch(
    actions,
    /return\s+\{\s*ok:\s*false[\s\S]*?error:\s*err\.message/,
  );
});

test('the Contributions inspector keeps implementation and keyboard notation out of visible copy', async () => {
  const inbox = await readSource('app/(ops)/ops/contributions/ContributionsInbox.tsx');

  assert.doesNotMatch(inbox, /Raw payload/);
  assert.doesNotMatch(inbox, /<kbd\b|kbdBadge/);
});

test('pending queues exclude facts whose parent contribution was rejected or expired', async () => {
  const queues = await readSource('lib/moderation/queues.ts');

  const counts = sourceBetween(
    queues,
    'export async function pendingQueueCounts',
    '// Read-only views of the moderation queues',
  );
  assert.ok(
    (counts.match(/contribution\.retain_until > now\(\)/g) ?? []).length >= 3,
    'all contribution-backed overview counts must exclude expired parent facts',
  );
  assert.ok(
    (counts.match(/join community_contributions contribution/g) ?? []).length >= 2,
    'edge and observation counts must join their parent contribution',
  );
  assert.ok(
    (counts.match(/contribution\.moderation_status <> 'rejected'/g) ?? []).length >= 2,
    'edge and observation counts must exclude rejected parent contributions',
  );

  const observations = sourceBetween(
    queues,
    'export async function listPendingObservations',
    'export type PendingContribution',
  );
  assert.match(observations, /join community_contributions contribution/);
  assert.match(observations, /contribution\.moderation_status <> 'rejected'/);
  assert.match(observations, /contribution\.retain_until > now\(\)/);

  const contributions = sourceBetween(
    queues,
    'export async function listPendingContributions',
    'export type PendingEdge',
  );
  assert.ok(
    (contributions.match(/contribution\.retain_until > now\(\)/g) ?? []).length >= 2,
    'both contribution list and detail queries must exclude expired rows',
  );

  const edges = sourceBetween(
    queues,
    'export async function listPendingEdges',
    'export type PendingModerationValue',
  );
  assert.ok(
    (edges.match(/join community_contributions contribution/g) ?? []).length >= 2,
    'both edge list and detail queries must join their parent contribution',
  );
  assert.ok(
    (edges.match(/contribution\.moderation_status <> 'rejected'/g) ?? []).length >= 2,
    'both edge list and detail queries must exclude rejected parents',
  );
  assert.ok(
    (edges.match(/contribution\.retain_until > now\(\)/g) ?? []).length >= 2,
    'both edge list and detail queries must exclude expired parents',
  );
});

test('the Contributions queue continues from a stable oldest-first identity', async () => {
  const [page, actions, queues, inbox, migration] = await Promise.all([
    readSource('app/(ops)/ops/contributions/page.tsx'),
    readSource('app/(ops)/ops/actions.ts'),
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/contributions/ContributionsInbox.tsx'),
    readSource('db/migrations/0027_community_contribution_fifo_index.sql'),
  ]);

  const contributions = sourceBetween(
    queues,
    'export type PendingContribution',
    'export type PendingEdge',
  );
  assert.match(contributions, /export type PendingContributionCursor/);
  assert.match(
    contributions,
    /and \(contribution\.submitted_at, contribution\.id\) > \([\s\S]*?\$\{after\.submittedAt\}::text::timestamptz,[\s\S]*?\$\{after\.id\}::uuid/,
  );
  assert.match(
    contributions,
    /order by contribution\.submitted_at asc, contribution\.id asc/,
  );
  assert.match(
    migration,
    /on community_contributions \(moderation_status, submitted_at asc, id asc\)/,
  );
  assert.match(migration, /where moderation_status = 'pending'/);

  assert.match(page, /const PAGE_SIZE = 40/);
  assert.match(page, /listPendingContributions\(sql,\s*PAGE_SIZE\s*\+\s*1\)/);
  assert.match(page, /\.slice\(0,\s*PAGE_SIZE\)/);
  assert.match(page, /\.length\s*>\s*PAGE_SIZE/);
  assert.doesNotMatch(page, /\.length\s*===\s*PAGE_SIZE/);
  assert.match(
    page,
    /\{ submittedAt: lastQueueRow\.submittedAt, id: lastQueueRow\.id \}/,
  );
  assert.match(page, /initialHasMore=\{hasMore\}/);
  assert.match(page, /initialCursor=\{nextCursor\}/);

  const continuation = sourceBetween(
    actions,
    'export async function fetchMoreContributionsAction',
    'export async function fetchMoreRelationshipsAction',
  );
  assert.match(continuation, /await requireConsoleOperator\(\)/);
  assert.match(continuation, /uuidPattern\.test\(afterId\)/);
  assert.match(
    continuation,
    /Number\.isFinite\(limit\) \? Math\.trunc\(limit\) : 40/,
  );
  assert.match(
    continuation,
    /Math\.min\(Math\.max\(requestedLimit, 1\), 100\)/,
  );
  assert.match(continuation, /safeLimit \+ 1/);
  assert.match(continuation, /submittedAt: afterSubmittedAt/);
  assert.doesNotMatch(continuation, /submittedAt: parsedDate\.toISOString\(\)/);
  assert.match(continuation, /fetchedRows\.slice\(0, safeLimit\)/);
  assert.match(
    continuation,
    /submittedAt: lastRow\.submittedAt, id: lastRow\.id/,
  );

  assert.match(inbox, /function queueRuntimeReducer/);
  assert.match(inbox, /left\.submittedAt < right\.submittedAt \? -1 : 1/);
  assert.doesNotMatch(
    inbox,
    /new Date\(left\.submittedAt\)\.getTime\(\)[\s\S]*?new Date\(right\.submittedAt\)\.getTime\(\)/,
  );
  assert.match(inbox, /const knownIds = new Set\(state\.extraRows\.map/);
  assert.match(inbox, /settled\.has\(row\.id\) \|\| knownIds\.has\(row\.id\)/);
  assert.match(inbox, /dispatchQueue\(\{ type: 'settled', id: actionState\.targetId \}\)/);
  assert.match(inbox, /new IntersectionObserver/);
  assert.match(
    inbox,
    /root: document\.querySelector<HTMLElement>\('\[data-ops-main\]'\)/,
  );
  assert.match(inbox, /queueState\.loadError[\s\S]*?return;/);
  assert.match(inbox, /'Try again'[\s\S]*?'Load more'/);
  assert.match(inbox, /<ContributionDetailSkeleton \/>/);
  assert.doesNotMatch(inbox, /autoSelectFirst=\{false\}/);
});

test('contribution decisions expose consequence, recovery, and a route-owned error state', async () => {
  const [inbox, errorRoute] = await Promise.all([
    readSource('app/(ops)/ops/contributions/ContributionsInbox.tsx'),
    readSource('app/(ops)/ops/contributions/error.tsx'),
  ]);

  assert.match(inbox, /Reject this submission\?/);
  assert.match(inbox, /linked \{[\s\S]*?\} will also be rejected\./);
  assert.match(inbox, />\s*Keep\s*<\/button>/);
  assert.match(inbox, /Contribution \$\{actionState\.decision === 'approve' \? 'approved' : 'rejected'\}\./);
  assert.match(inbox, /role="status" aria-live="polite"/);

  assert.match(errorRoute, /<OpsWorkspace title="Contributions">/);
  assert.match(errorRoute, /title="Couldn’t load contributions"/);
  assert.match(errorRoute, /onRetry=\{reset\}/);
  assert.doesNotMatch(errorRoute, /\{error\.(?:message|stack)\}/);
});

test('shared inbox controls cannot bypass deliberate decisions and restore valid focus', async () => {
  const inbox = await readSource('components/ops/inbox/InboxContainer.tsx');

  assert.doesNotMatch(inbox, /e\.key === ['"](?:e|a|r|m)['"]/);
  assert.doesNotMatch(inbox, /button\[value="(?:approve|reject|map)"\]/);
  assert.match(inbox, /useOpsOverlay\(\{/);
  assert.match(inbox, /returnFocusRef: lastTriggerRef/);
  assert.match(inbox, /document\.getElementById\(`row-\$\{nextItem\.id\}`\)\?\.focus/);
  assert.match(inbox, /const isCollectionRow = target\?\.closest\('\[data-ops-collection-item\]'\)/);
});

test('responsive inspectors, controls, and shell scroll ownership are source-enforced', async () => {
  const [inboxCss, inspectorCss, shellCss, opsCss] = await Promise.all([
    readSource('components/ops/inbox/inbox.module.css'),
    readSource('components/ops/inbox/inbox-tablet.module.css'),
    readSource('components/ops/shell/ops-tablet.module.css'),
    readSource('app/(ops)/ops.module.css'),
  ]);

  assert.match(inspectorCss, /@media \(max-width: 819px\)[\s\S]*?align-items: flex-end;[\s\S]*?height: 88dvh;/);
  assert.match(inspectorCss, /\.tabletClose \{[\s\S]*?width: var\(--touch-min\);[\s\S]*?height: var\(--touch-min\);/);
  assert.match(inboxCss, /@media \(max-width: 1179px\)[\s\S]*?\.btn \{[\s\S]*?min-height: var\(--touch-min\);/);
  assert.match(inboxCss, /@media \(max-width: 819px\), \(pointer: coarse\)[\s\S]*?\.railControls button \{[\s\S]*?width: var\(--touch-min\);[\s\S]*?height: var\(--touch-min\);/);
  assert.match(shellCss, /@media \(max-width: 819px\)[\s\S]*?\.sidebarLayer \{[\s\S]*?visibility: hidden;/);
  assert.match(shellCss, /@media \(max-width: 819px\)[\s\S]*?\.detailPane \{[\s\S]*?inset: 0;/);
  assert.match(shellCss, /\.sheetClose \{[\s\S]*?width: var\(--touch-min\);[\s\S]*?height: var\(--touch-min\);/);
  assert.match(opsCss, /\.body \{[\s\S]*?overflow: clip;/);
});

test('empty queue state stays flat instead of nesting another surfaced card', async () => {
  const stateCss = await readSource('components/ops/state/state.module.css');
  const emptyRule = sourceBetween(stateCss, '.empty {', '.emptyTitle');

  assert.doesNotMatch(emptyRule, /background:/);
  assert.doesNotMatch(emptyRule, /box-shadow:/);
  assert.doesNotMatch(emptyRule, /border-radius:/);
});
