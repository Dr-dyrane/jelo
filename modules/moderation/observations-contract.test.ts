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

test('Activity opens one selected settled observation without adding it to pending work', async () => {
  const [
    page,
    queues,
    inbox,
    actions,
    activity,
    loading,
    errorRoute,
    capabilities,
    inboxStyles,
    tabletStyles,
    activityLinks,
    detailSkeleton,
  ] = await Promise.all([
    readSource('app/(ops)/ops/observations/page.tsx'),
    readSource('lib/moderation/queues.ts'),
    readSource('app/(ops)/ops/observations/ObservationsInbox.tsx'),
    readSource('app/(ops)/ops/actions.ts'),
    readSource('app/(ops)/ops/activity/ActivityInsights.tsx'),
    readSource('app/(ops)/ops/observations/loading.tsx'),
    readSource('app/(ops)/ops/observations/error.tsx'),
    readSource('lib/moderation/capabilities.ts'),
    readSource('components/ops/inbox/inbox.module.css'),
    readSource('components/ops/inbox/inbox-tablet.module.css'),
    readSource('lib/moderation/activity-links.ts'),
    readSource('app/(ops)/ops/observations/ObservationDetailSkeleton.tsx'),
  ]);
  const settledQuery = sourceBetween(
    queues,
    'export async function findSettledObservation',
    'export type PendingContribution',
  );
  const correctionAction = sourceBetween(
    actions,
    'export async function correctObservationAction',
    'export async function fetchMoreObservationsAction',
  );

  assert.match(activity, /activityObservationHref\(decision\.queue, decision\.targetRef\)/);
  assert.match(activity, /\{observationHref \? \(/);
  assert.match(activity, /href=\{observationHref\}/);
  assert.match(activity, />\s*View report\s*<\/Link>/);
  assert.doesNotMatch(activity, /audit(?:Id|Status).*\/ops\/observations/i);
  assert.match(activityLinks, /queue !== 'community_observation'/);
  assert.match(activityLinks, /isQueueItemUuid\(targetRef\)/);
  assert.match(activityLinks, /`\/ops\/observations\?id=\$\{encodeURIComponent\(targetRef\)\}`/);
  assert.match(page, /selectedQueueUuid\(await searchParams\)/);
  assert.match(page, /findPendingObservation\(sql, selectedId\)[\s\S]*?findSettledObservation\(sql, selectedId\)/);
  assert.match(settledQuery, /if \(!isQueueItemUuid\(id\)\) return null/);
  assert.match(settledQuery, /moderation_status in \('approved', 'rejected'\)/);
  assert.match(settledQuery, /as parent_eligible_for_review/);
  assert.doesNotMatch(settledQuery, /moderation_status = 'pending'/);
  assert.match(inbox, /row\.moderationStatus === 'pending'/);
  assert.match(inbox, /moderationStatus !== 'pending'\)\.slice\(0, 1\)/);
  assert.match(inbox, /label: 'Reviewed decision'/);
  assert.match(inbox, /row\.moderationStatus === 'approved' \? 'Approved' : 'Rejected'/);
  assert.match(inbox, /isSettled && row\.parentEligibleForReview && canCorrect/);
  assert.match(inbox, /Return to review/);
  assert.match(inbox, /The recorded decision stays in history\./);
  assert.doesNotMatch(inbox, /This report is \{row\.moderationStatus/);
  assert.match(inbox, /Reason for returning to review/);
  assert.match(inbox, /name="rationale"[\s\S]*?required[\s\S]*?defaultValue=""/);
  assert.match(inbox, /data-item-id=\{row\.id\}[\s\S]*?className=\{`\$\{styles\.decideSection\} \$\{observationStyles\.correctionFooter\}`\}/);
  assert.match(inbox, /htmlFor=\{`correction-rationale-\$\{row\.id\}`\}/);
  assert.match(inbox, /aria-busy=\{isCorrectionPending\}/);
  assert.equal((inbox.match(/Report returned to review\./g) ?? []).length, 1);
  assert.equal((inbox.match(/className=\{observationStyles\.liveStatus\}/g) ?? []).length, 1);
  assert.match(inbox, /aria-live="polite"/);
  const detailScroll = inbox.indexOf('<div className={styles.detailScroll}>');
  const correctionFooter = inbox.indexOf(
    '{isSettled && row.parentEligibleForReview && canCorrect ? (',
    detailScroll,
  );
  const detailScrollClose = inbox.lastIndexOf('</div>', correctionFooter);
  assert.ok(detailScroll !== -1 && detailScrollClose > detailScroll && correctionFooter > detailScrollClose);
  assert.match(inbox, /correctObservationAction/);
  assert.match(inbox, /latestAnnouncement === 'correction'/);
  assert.match(inbox, /dispatchCorrectionFeedback\(\{ type: 'clear' \}\)/);
  assert.match(inbox, /current === 'correction' \? null : current/);
  assert.match(inbox, /correctionFocusTargetRef\.current = active\.targetId/);
  assert.match(inbox, /correctionFocusTargetRef\.current = null/);
  assert.match(inbox, /activeCorrectionRef\.current = null/);
  assert.match(inbox, /observationCorrectionFeedbackReducer/);
  assert.match(inbox, /observationCorrectionFeedbackForTarget/);
  assert.match(inbox, /const submissionId = crypto\.randomUUID\(\)/);
  assert.match(inbox, /formData\.set\('submissionId', submissionId\)/);
  assert.match(inbox, /formData\.set\('disposition', disposition\)/);
  assert.match(inbox, /name="submissionId" value=""/);
  assert.match(inbox, /name="disposition" value="defer"/);
  assert.match(inbox, /row\.id === targetId && row\.moderationStatus === 'pending'/);
  assert.match(inbox, /textarea\[name="rationale"\]/);
  const correctionSuccess = sourceBetween(
    inbox,
    'if (!correctionState) return;',
    'const actionAnnouncement',
  );
  assert.match(correctionSuccess, /router\.refresh\(\)/);
  assert.match(correctionSuccess, /if \(!correctionState\.ok\)/);
  assert.match(correctionSuccess, /active\.submissionId !== correctionState\.submissionId/);
  assert.match(correctionSuccess, /active\.targetId !== correctionState\.targetId/);
  assert.match(correctionSuccess, /active\.disposition !== correctionState\.disposition/);
  assert.doesNotMatch(correctionSuccess, /settleItem|type: 'settled'/);
  assert.match(correctionAction, /assertCan\(operator, 'observations\.correct'\)/);
  assert.match(correctionAction, /submissionId: formData\.get\('submissionId'\)/);
  assert.match(correctionAction, /disposition: formData\.get\('disposition'\)/);
  assert.match(correctionAction, /correctObservationDecision\(/);
  assert.match(
    correctionAction,
    /return \{ ok: true, targetId, submissionId, disposition, decision: disposition \}/,
  );
  assert.match(
    correctionAction,
    /submissionId: requestedSubmission\.success \? requestedSubmission\.data : undefined/,
  );
  assert.match(capabilities, /admin:[\s\S]*?'observations\.correct'/);
  assert.doesNotMatch(capabilities, /moderator:[^\n]*'observations\.correct'/);
  assert.match(loading, /data-ops-reserve-detail/);
  assert.match(loading, /<ObservationDetailSkeleton announce=\{false\}/);
  assert.match(errorRoute, /<OpsWorkspace title="Observations">/);
  assert.match(errorRoute, /onRetry=\{reset\}/);
  assert.match(detailSkeleton, />Review<\/h3>/);
  assert.doesNotMatch(detailSkeleton, /btnApprove|btnReject/);
  assert.match(inboxStyles, /\.btn\s*\{[\s\S]*?min-height:\s*34px/);
  assert.match(inboxStyles, /@media \(max-width: 1179px\)[\s\S]*?\.btn\s*\{[\s\S]*?min-height:\s*var\(--touch-min\)/);
  assert.match(inboxStyles, /\.note:focus-visible\s*\{/);
  assert.match(inboxStyles, /\.btn:focus-visible\s*\{/);
  assert.match(tabletStyles, /form\[data-item-id\] \[data-ops-decision-actions\]/);

  const pendingCounts = sourceBetween(
    queues,
    'export async function pendingQueueCounts',
    'export type PendingObservation',
  );
  assert.match(pendingCounts, /observation\.moderation_status = 'pending'/);
  assert.doesNotMatch(pendingCounts, /findSettledObservation|approved', 'rejected/);
});

test('the private observation correction command previews and applies the shared writer', async () => {
  const cli = await readSource('scripts/manage-community-data.ts');
  const correction = sourceBetween(
    cli,
    "if (command.action === 'correct')",
    "if (!await moderationTargetExists",
  );

  assert.match(correction, /preflightObservationCorrection\(/);
  assert.match(correction, /if \(!command\.apply\)/);
  assert.match(correction, /previousStatus: planned\.previousStatus/);
  assert.match(correction, /nextStatus: planned\.nextStatus/);
  assert.match(correction, /previousDecisionAuditId: planned\.previousDecisionAuditId/);
  assert.match(correction, /correctObservationDecision\(/);
});
