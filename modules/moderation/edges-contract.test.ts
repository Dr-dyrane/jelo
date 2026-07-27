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

test('the Edges trial has one quiet route title and no explanatory lede', async () => {
  const [page, loading, errorRoute, workspace] = await Promise.all([
    readSource('app/(ops)/ops/edges/page.tsx'),
    readSource('app/(ops)/ops/edges/loading.tsx'),
    readSource('app/(ops)/ops/edges/error.tsx'),
    readSource('components/ops/workspace/OpsWorkspace.tsx'),
  ]);

  assert.equal((page.match(/<OpsWorkspace title="Relationships">/g) ?? []).length, 1);
  assert.match(loading, /<OpsWorkspace title="Relationships">/);
  assert.match(errorRoute, /<OpsWorkspace title="Relationships">/);
  assert.doesNotMatch(workspace, /\blede\b|workspaceLede/);
  assert.doesNotMatch(page, /<h1\b|\blede=|opsStyles\.lede/);
  assert.doesNotMatch(`${page}\n${loading}`, /<h2[^>]*>\s*Relationships\s*<\/h2>/);
});

test('primary relationship UI does not expose graph, schema, UUID, or raw-reference language', async () => {
  const [page, inbox, chrome, overview] = await Promise.all([
    readSource('app/(ops)/ops/edges/page.tsx'),
    readSource('app/(ops)/ops/edges/EdgesInbox.tsx'),
    readSource('components/ops/shell/OpsChrome.tsx'),
    readSource('app/(ops)/ops/OverviewBriefing.tsx'),
  ]);
  const primaryInbox = inbox.split('<details')[0] ?? inbox;
  const primary = `${page}\n${primaryInbox}`;

  assert.doesNotMatch(
    primary,
    /Knowledge edges|Typed triples|No pending edges|Triples connecting|knowledge edge|Subject kind|Object kind|Raw payload|Clinical safety advisory/,
  );
  assert.doesNotMatch(inbox, /<pre\b|JSON\.stringify/);
  assert.doesNotMatch(primary, /humanizeRef|ProductRef/);
  assert.doesNotMatch(primary, /\{row\.(?:predicate|subjectKind|objectKind|subjectRef|objectRef|contributionId|confidenceState)\}/);
  assert.doesNotMatch(inbox, /itemTypeLabel="knowledge edge"|permissions[^<]*knowledge edges/i);
  assert.doesNotMatch(chrome, /label:\s*['"]Edges['"]/);
  assert.doesNotMatch(overview, /['"]Knowledge edge['"]/);
});

test('the route consumes the shared typed relationship projection instead of reparsing queue rows', async () => {
  const [page, inbox, projection] = await Promise.all([
    readSource('app/(ops)/ops/edges/page.tsx'),
    readSource('app/(ops)/ops/edges/EdgesInbox.tsx'),
    readSource('lib/moderation/edge-presentation.ts'),
  ]);

  assert.match(page, /edgeReviewItem/);
  assert.match(inbox, /EdgeReviewItem[\s\S]*?from ['"]@\/lib\/moderation\/edge-presentation['"]/);
  assert.doesNotMatch(page, /findCatalogueProduct|listProductIngredientsSafe|humanizeRef/);
  assert.doesNotMatch(inbox, /PendingEdge|humanizeRef|money\(|outcomeLabel\(/);
  assert.match(projection, /export type EdgeReviewItem/);
  assert.match(projection, /export function edgeReviewItem/);
});

test('relationship sections follow operator context and loading preserves the same composition', async () => {
  const [inbox, loading] = await Promise.all([
    readSource('app/(ops)/ops/edges/EdgesInbox.tsx'),
    readSource('app/(ops)/ops/edges/loading.tsx'),
  ]);

  for (const label of ['Up next', 'Product context', 'Stores', 'Results and prices']) {
    assert.match(inbox, new RegExp(`label: '${label}'`));
    assert.match(loading, new RegExp(`label: '${label}'`));
  }
  assert.match(inbox, /presentation: 'feature-shelf'/);
  assert.match(inbox, /presentation: 'horizontal-rail'/);
  assert.match(inbox, /presentation: 'compact-rows'/);
  assert.match(inbox, /data-presentation=\{presentation\}/);
  assert.doesNotMatch(`${inbox}\n${loading}`, /Community reports/);
  assert.doesNotMatch(inbox, /Community context|>Confidence</);
});

test('the relationship queue is oldest-first and continues past its initial server window', async () => {
  const [page, queues, inbox, actions, migration] = await Promise.all([
    readSource('app/(ops)/ops/edges/page.tsx'),
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/edges/EdgesInbox.tsx'),
    readSource('app/(ops)/ops/actions.ts'),
    readSource('db/migrations/0028_moderation_queue_fifo_indexes.sql'),
  ]);
  const edgeQueue = sourceBetween(
    queues,
    'export async function listPendingEdges',
    'export async function findPendingEdge',
  );

  assert.match(edgeQueue, /order by edge\.created_at asc,\s*edge\.id asc/);
  assert.match(
    edgeQueue,
    /\(edge\.created_at,\s*edge\.id\)\s*>\s*\([\s\S]*?\$\{after\.createdAt\}::text::timestamptz,[\s\S]*?\$\{after\.id\}::uuid/,
  );
  assert.match(
    migration,
    /on community_knowledge_edges \(moderation_status, created_at asc, id asc\)[\s\S]*?where moderation_status = 'pending'/,
  );
  assert.match(page, /listPendingEdges\(sql,\s*LIMIT\s*\+\s*1\)/);
  assert.match(page, /\.slice\(0,\s*LIMIT\)/);
  assert.match(page, /\.length\s*>\s*LIMIT/);
  assert.doesNotMatch(page, /\.length\s*===\s*LIMIT/);
  assert.match(page, /initialHasMore=\{hasMore\}/);
  assert.match(page, /initialCursor=\{nextCursor\}/);
  assert.match(page, /includeSelectedQueueItem\(/);
  const continuation = sourceBetween(
    actions,
    'export async function fetchMoreRelationshipsAction',
    'export async function decideObservationAction',
  );
  assert.match(continuation, /Number\.isFinite\(limit\) \? Math\.trunc\(limit\) : 40/);
  assert.match(continuation, /listPendingEdges\([\s\S]*?safeLimit \+ 1,[\s\S]*?createdAt: afterCreatedAt,[\s\S]*?id:/);
  assert.doesNotMatch(continuation, /createdAt: parsedDate\.toISOString\(\)/);
  assert.match(inbox, /fetchMoreRelationshipsAction\(/);
  assert.match(inbox, /left\.createdAt < right\.createdAt \? -1 : 1/);
  assert.doesNotMatch(inbox, /new Date\(left\.createdAt\)/);
  assert.match(inbox, /left\.id < right\.id \? -1 : 1/);
  assert.doesNotMatch(inbox, /left\.id\.localeCompare/);
  assert.match(inbox, /settled\.has\(row\.id\) \|\| knownIds\.has\(row\.id\)/);
  assert.match(inbox, /new IntersectionObserver/);
  assert.match(inbox, /ref=\{loadSentinelRef\}/);
  assert.match(inbox, /:\s*'Load more'/);
  assert.match(inbox, /items=\{loadedRows\}/);
  assert.doesNotMatch(`${page}\n${inbox}`, /All .* shown|most recent|complete queue/i);
});

test('loading follows resolved desktop behavior instead of URL timing', async () => {
  const loading = await readSource('app/(ops)/ops/edges/loading.tsx');

  assert.doesNotMatch(loading, /useSearchParams|searchParams|selectedId/);
  assert.match(loading, /useSyncExternalStore/);
  assert.match(loading, /window\.matchMedia\('\(min-width: 1180px\)'\)\.matches/);
  assert.match(loading, /<DetailSkeleton \/>/);
  assert.match(loading, /createPortal\(<RelationshipDetailSkeleton announce=\{false\} \/>/);
  assert.doesNotMatch(loading, /role="dialog"|aria-modal="true"|tabletStage/);
});

test('relationship selection gives immediate row and inspector feedback', async () => {
  const [inbox, sharedInbox] = await Promise.all([
    readSource('app/(ops)/ops/edges/EdgesInbox.tsx'),
    readSource('components/ops/inbox/InboxContainer.tsx'),
  ]);

  assert.match(inbox, /pendingSelectionId=\{selection\.pendingSelectionId\}/);
  assert.match(
    inbox,
    /selection\.pendingSelectionId === row\.id[\s\S]*?<RelationshipDetailSkeleton/,
  );
  assert.match(sharedInbox, /aria-busy=\{pendingSelectionId === item\.id \? 'true' : undefined\}/);
  assert.match(sharedInbox, /createPortal\(<Fragment key=\{activeItem\.id\}>/);
  assert.doesNotMatch(
    sharedInbox,
    /requestedIndex >= 0[\s\S]{0,180}: !isControlled[\s\S]{0,120}: null;/,
    'a populated controlled queue must not blank the ready-state inspector while its first URL selection reconciles',
  );
});

test('responsive inspectors are siblings or overlays with complete focus recovery', async () => {
  const [sharedInbox, inspectorCss, opsCss, shellCss] = await Promise.all([
    readSource('components/ops/inbox/InboxContainer.tsx'),
    readSource('components/ops/inbox/inbox-tablet.module.css'),
    readSource('app/(ops)/ops.module.css'),
    readSource('components/ops/shell/ops-tablet.module.css'),
  ]);

  assert.match(sharedInbox, /usesDockedInspector/);
  assert.match(sharedInbox, /usesOverlayInspector/);
  assert.match(sharedInbox, /createPortal\(/);
  assert.match(sharedInbox, /role="dialog"[\s\S]{0,100}aria-modal="true"/);
  assert.match(sharedInbox, /getItemLabel\?\.\(activeItem\) \?\? itemTypeLabel/);
  assert.match(sharedInbox, /useOpsOverlay\(\{/);
  assert.match(sharedInbox, /inertTargetSelectors: OPS_OVERLAY_INERT_TARGETS/);
  assert.match(sharedInbox, /returnFocusRef: lastTriggerRef/);
  assert.doesNotMatch(sharedInbox, /document\.body\.style\.overflow = 'hidden'/);
  assert.doesNotMatch(sharedInbox, /handleOverlayKeyDown/);
  assert.match(inspectorCss, /@media \(max-width: 819px\)[\s\S]*?align-items: flex-end;/);
  assert.match(inspectorCss, /\.tabletInspectorBody \{[\s\S]*?overflow: hidden;/);
  assert.match(shellCss, /@media \(max-width: 819px\)[\s\S]*?\.detailPane \{[\s\S]*?inset: 0;/);
  assert.match(opsCss, /@media \(min-width: 1180px\)[\s\S]*?\.detailPane \{[\s\S]*?overflow: hidden;/);
});

test('touch actions and the phone contextual FAB stay reachable', async () => {
  const [sharedInbox, inboxCss, inspectorCss] = await Promise.all([
    readSource('components/ops/inbox/InboxContainer.tsx'),
    readSource('components/ops/inbox/inbox.module.css'),
    readSource('components/ops/inbox/inbox-tablet.module.css'),
  ]);

  assert.match(sharedInbox, /setContextFab\(\{/);
  assert.match(sharedInbox, /label: `Open current \$\{itemTypeLabel\}`/);
  assert.match(inboxCss, /@media \(max-width: 1179px\)[\s\S]*?\.btn \{[\s\S]*?min-height: var\(--touch-min\);/);
  assert.match(inspectorCss, /\.tabletClose \{[\s\S]*?width: var\(--touch-min\);[\s\S]*?height: var\(--touch-min\);/);
});

test('destructive decisions have no single-key shortcut and rejection explains its exact consequence inline', async () => {
  const [inbox, sharedInbox] = await Promise.all([
    readSource('app/(ops)/ops/edges/EdgesInbox.tsx'),
    readSource('components/ops/inbox/InboxContainer.tsx'),
  ]);

  assert.doesNotMatch(sharedInbox, /e\.key === ['"](?:e|a|r|m)['"]/);
  assert.doesNotMatch(sharedInbox, /button\[value="(?:approve|reject|map)"\]/);
  assert.match(inbox, /rejectConfirmId/);
  assert.match(inbox, /Reject this relationship\?/);
  assert.match(inbox, /This removes only this relationship from the review queue\./);
  assert.match(inbox, />\s*Keep\s*<\/button>/);
  assert.match(inbox, /role="status" aria-live="polite"/);
});

test('empty and error states remain quiet, route-owned, and diagnostic-safe', async () => {
  const [page, errorRoute, stateCss, actions] = await Promise.all([
    readSource('app/(ops)/ops/edges/page.tsx'),
    readSource('app/(ops)/ops/edges/error.tsx'),
    readSource('components/ops/state/state.module.css'),
    readSource('app/(ops)/ops/actions.ts'),
  ]);
  const emptyRule = sourceBetween(stateCss, '.empty {', '.emptyTitle');

  assert.match(page, /title="You’re caught up\."/);
  assert.match(page, /body="There’s nothing waiting\."/);
  assert.match(page, /action=\{\{ href: '\/ops\/activity', label: 'View insights' \}\}/);
  assert.match(errorRoute, /title="Couldn’t load relationships"/);
  assert.match(errorRoute, /onRetry=\{reset\}/);
  assert.doesNotMatch(errorRoute, /\{error\.(?:message|stack)\}/);
  assert.doesNotMatch(emptyRule, /background:|box-shadow:|border-radius:/);
  assert.doesNotMatch(actions, /error:\s*err\.(?:message|stack)/);
});

test('relationship cards surface only approved imagery and preserve readable long meaning', async () => {
  const [inbox, edgeCss] = await Promise.all([
    readSource('app/(ops)/ops/edges/EdgesInbox.tsx'),
    readSource('app/(ops)/ops/edges/edges.module.css'),
  ]);
  const rowRule = sourceBetween(edgeCss, '.relationshipRow {', '}');
  const sentenceRule = sourceBetween(edgeCss, '.relationshipSentence {', '}');

  assert.match(inbox, /row\.image\s*(?:\?|&&)/);
  assert.doesNotMatch(inbox, /product-placeholder|row\.(?:subjectProduct|objectProduct)/);
  assert.doesNotMatch(inbox, /style=\{\{/);
  assert.match(edgeCss, /\.relationshipVisual \{[\s\S]*?background:/);
  assert.doesNotMatch(rowRule, /background:|box-shadow:|border:/);
  assert.match(sentenceRule, /white-space:\s*normal|overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(sentenceRule, /text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/);
  assert.doesNotMatch(
    inbox,
    /row\.(?:title|sentence|summary|object\.label)\.(?:slice|substring)\(/,
  );
});

test('the shell clips the viewport while workspace and inspector own their scroll', async () => {
  const [opsCss, inboxCss] = await Promise.all([
    readSource('app/(ops)/ops.module.css'),
    readSource('components/ops/inbox/inbox.module.css'),
  ]);

  assert.match(opsCss, /\.body \{[\s\S]*?height: 100dvh;[\s\S]*?overflow: clip;/);
  assert.match(opsCss, /@media \(min-width: 820px\)[\s\S]*?\.contentWrapper \{[\s\S]*?overflow: clip;/);
  assert.match(opsCss, /@media \(min-width: 820px\)[\s\S]*?\.main \{[\s\S]*?min-height: 0;[\s\S]*?overflow: auto;/);
  assert.match(opsCss, /@media \(min-width: 1180px\)[\s\S]*?\.detailPane \{[\s\S]*?overflow: hidden;/);
  assert.match(inboxCss, /\.detailScroll \{[\s\S]*?overflow-y: auto;/);
});
