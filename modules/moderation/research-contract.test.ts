import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const readSource = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8');

test('research work has a private manual route, durable ownership, and role checks', async () => {
  const [page, inbox, actions, readModel, transitions, migration, shell, capabilities] = await Promise.all([
    readSource('app/(ops)/ops/research/page.tsx'),
    readSource('app/(ops)/ops/research/ResearchInbox.tsx'),
    readSource('app/(ops)/ops/research/actions.ts'),
    readSource('lib/moderation/research-tasks.ts'),
    readSource('lib/moderation/database-transitions.ts'),
    readSource('db/migrations/0030_community_research_workflow.sql'),
    readSource('components/ops/shell/OpsChrome.tsx'),
    readSource('lib/moderation/capabilities.ts'),
  ]);

  assert.match(page, /requireConsoleOperator/);
  assert.match(page, /listPendingResearchTasks/);
  assert.match(inbox, /InboxContainer/);
  assert.match(inbox, /Assign to me/);
  assert.match(inbox, /Reassign/);
  assert.match(inbox, /Unassign/);
  assert.match(inbox, /Block with reason/);
  assert.match(inbox, /Record outcome/);
  assert.match(actions, /assertCan\(operator, 'research\.manage'\)/);
  assert.match(actions, /assertCan\(operator, administrativeAssignment \? 'research\.assign' : 'research\.manage'\)/);
  assert.match(actions, /resolveCommunityProductResearchTask/);
  assert.match(actions, /resolveCommunityRetailerResearchTask/);
  assert.match(readModel, /status in \('pending', 'in-progress'\)/);
  assert.match(readModel, /task\.signal_count > 0/);
  assert.match(readModel, /assigned_operator_id/);
  assert.match(transitions, /work_state = \$\{planned\.workState\}/);
  assert.match(transitions, /next_action = \$\{planned\.workState === 'ready' \? null : rationale\}/);
  assert.match(transitions, /for update/);
  assert.match(transitions, /operator\.role !== 'admin'/);
  assert.match(transitions, /previousOwnerId/);
  assert.match(migration, /community_research_tasks_assignment_check/);
  assert.match(shell, /href: '\/ops\/research'/);
  assert.match(capabilities, /'research\.manage'/);
});

test('research outcomes remain non-canonical and exact-target bound', async () => {
  const [productWriter, retailerWriter] = await Promise.all([
    readSource('lib/community-intake/research-resolution.ts'),
    readSource('lib/community-intake/retailer-research-resolution.ts'),
  ]);

  assert.match(productWriter, /is_published = true/);
  assert.match(productWriter, /isReleasedIntakeCandidate/);
  assert.match(productWriter, /task\.taskKind !== 'product-identity'/);
  assert.match(productWriter, /task\.entitySource !== 'canonical'/);
  assert.match(retailerWriter, /task\.entitySource !== 'canonical'/);
  assert.match(retailerWriter, /select 1 from retailers/);
  assert.doesNotMatch(retailerWriter, /\b(insert into|update)\s+(retailers|offers|products)\b/i);
});

test('research queue covers production-shaped identity, pagination, inspector states, and accessible actions', async () => {
  const [page, inbox, actions, readModel, loading, error, css] = await Promise.all([
    readSource('app/(ops)/ops/research/page.tsx'),
    readSource('app/(ops)/ops/research/ResearchInbox.tsx'),
    readSource('app/(ops)/ops/research/actions.ts'),
    readSource('lib/moderation/research-tasks.ts'),
    readSource('app/(ops)/ops/research/loading.tsx'),
    readSource('app/(ops)/ops/research/error.tsx'),
    readSource('app/(ops)/ops/research/research.module.css'),
  ]);

  assert.match(readModel, /canonicalTargetRef/);
  assert.match(readModel, /canonicalResearchEntitySlug\(row\.entity_kind, row\.entity_ref\)/);
  assert.match(readModel, /resolveOpsProductImages/);
  assert.match(readModel, /afterCursor/);
  assert.match(page, /LIMIT \+ 1/);
  assert.match(page, /findPendingResearchTask/);
  assert.match(page, /initialHasMore/);
  assert.match(page, /const unreleasedCandidates = canManage/);
  assert.match(actions, /fetchMoreResearchTasksAction/);
  assert.match(inbox, /SafeProductImage/);
  assert.match(inbox, /\[\.\.\.state\.extraRows, \.\.\.initialRows\]/);
  assert.match(inbox, /row\.entitySource === 'canonical'[\s\S]*?\[options\[0\]\]/);
  assert.match(inbox, /canonicalOptions\.products/);
  assert.match(inbox, /Choose a reviewed record/);
  assert.doesNotMatch(inbox, /placeholder="Exact reviewed record"/);
  assert.match(inbox, /detailScroll[\s\S]*?<ResearchForms/);
  assert.match(inbox, /form=\{assignmentFormId\}/);
  assert.match(inbox, /form=\{resolutionFormId\}/);
  assert.match(inbox, /aria-busy=\{pending/);
  assert.match(inbox, /role="status"/);
  assert.match(inbox, /requestId/);
  assert.match(inbox, /latestSubmission/);
  assert.match(inbox, /assignState\.targetId === latestSubmission\.targetId/);
  assert.match(inbox, /assignState\.action === latestSubmission\.action/);
  assert.match(inbox, /row\.assignedOperatorId === null[\s\S]*?row\.isOwnedByCurrentOperator[\s\S]*?canAssign/);
  assert.match(inbox, /End of the research queue/);
  assert.match(inbox, /'Try again'/);
  assert.doesNotMatch(inbox, /Exact target|Canonical slug or intake ID|Signals/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /white-space: pre-wrap/);
  assert.match(loading, /OpsWorkspace title="Research"/);
  assert.match(loading, /ResearchDetailSkeleton/);
  assert.match(loading, /data-ops-reserve-detail/);
  assert.match(error, /OpsWorkspace title="Research"/);
  assert.doesNotMatch(error, /data-ops-reserve-detail/);
});

test('research command dry-runs use the same authoritative preflight as apply', async () => {
  const [productScript, retailerScript, moderationScript] = await Promise.all([
    readSource('scripts/resolve-community-research-task.ts'),
    readSource('scripts/resolve-community-retailer-research-task.ts'),
    readSource('scripts/manage-community-data.ts'),
  ]);
  assert.match(productScript, /await preflightCommunityProductResearchTask\(sql, resolution\)/);
  assert.match(retailerScript, /await preflightCommunityRetailerResearchTask\(sql, resolution\)/);
  assert.match(moderationScript, /await preflightResearchAssignment\(/);
  for (const source of [productScript, retailerScript]) {
    assert.ok(
      source.indexOf('await preflightCommunity') < source.indexOf('command.apply\n      ?'),
      'preflight must run before the dry-run/apply branch',
    );
  }
});
