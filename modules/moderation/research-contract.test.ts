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
  assert.match(inbox, /Block with reason/);
  assert.match(inbox, /Record outcome/);
  assert.match(actions, /assertCan\(operator, 'research\.manage'\)/);
  assert.match(actions, /resolveCommunityProductResearchTask/);
  assert.match(actions, /resolveCommunityRetailerResearchTask/);
  assert.match(readModel, /status in \('pending', 'in-progress'\)/);
  assert.match(readModel, /assigned_operator_id/);
  assert.match(transitions, /work_state = \$\{workState\}/);
  assert.match(transitions, /next_action = \$\{rationale\}/);
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
  assert.match(productWriter, /catalogueIntakeCandidates\.some/);
  assert.match(productWriter, /task\.entity_source === 'canonical'/);
  assert.match(retailerWriter, /task\.entity_source === 'canonical'/);
  assert.match(retailerWriter, /select 1 from retailers/);
  assert.doesNotMatch(retailerWriter, /\b(insert into|update)\s+(retailers|offers|products)\b/i);
});
