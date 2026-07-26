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

  // Compact inspectors are interaction-driven sheets in the ready state. The
  // route fallback must not invent an already-open dialog.
  assert.doesNotMatch(loading, /role="dialog"|aria-modal="true"|tabletStage/);
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

test('the Contributions list over-fetches one row before declaring the queue partial', async () => {
  const page = await readSource('app/(ops)/ops/contributions/page.tsx');

  assert.match(page, /listPendingContributions\(sql,\s*LIMIT\s*\+\s*1\)/);
  assert.match(page, /\.slice\(0,\s*LIMIT\)/);
  assert.match(page, /\.length\s*>\s*LIMIT/);
  assert.doesNotMatch(page, /\.length\s*===\s*LIMIT/);
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
  assert.match(inbox, /button:not\(\[disabled\]\):not\(\[tabindex="-1"\]\)/);
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
