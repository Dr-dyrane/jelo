import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseCommunityRetailerResearchResolutionCommand } from '@/lib/community-intake/retailer-research-resolution-command';
import {
  buildCommunityRetailerResearchResolution,
  communityRetailerResearchResolutionSchema,
} from '@/lib/community-intake/retailer-research-resolution';

const taskId = '6b1629ce-b151-4ed6-b91d-b985a6d725d8';
const common = {
  taskId,
  reviewedBy: 'neon-auth|operator-1',
  rationale: 'The task reference exactly matches the canonical retailer record.',
};

test('a canonical retailer resolution is private and has one exact target', () => {
  assert.deepEqual(buildCommunityRetailerResearchResolution({
    ...common,
    outcome: 'existing-canonical-retailer',
    canonicalSlug: 'healthplus',
  }), {
    taskId,
    outcome: 'existing-canonical-retailer',
    canonicalRetailerSlug: 'healthplus',
    reviewedBy: 'neon-auth|operator-1',
    rationale: common.rationale,
    auditMetadata: {},
    canonicalWrite: false,
    publicationStatus: 'private-research-only',
    taskStatus: 'completed',
  });
  assert.throws(() => communityRetailerResearchResolutionSchema.parse({
    ...common,
    outcome: 'existing-canonical-retailer',
  }));
});

test('ambiguous and duplicate retailer outcomes cannot name a canonical target', () => {
  assert.equal(buildCommunityRetailerResearchResolution({
    ...common,
    outcome: 'ambiguous-retailer',
  }).taskStatus, 'completed');
  assert.equal(buildCommunityRetailerResearchResolution({
    ...common,
    outcome: 'dismissed-duplicate',
  }).taskStatus, 'dismissed');
  assert.throws(() => communityRetailerResearchResolutionSchema.parse({
    ...common,
    outcome: 'ambiguous-retailer',
    canonicalSlug: 'healthplus',
  }));
});

test('the retailer resolution command is dry-run and target-specific', () => {
  const command = parseCommunityRetailerResearchResolutionCommand([
    '--task-id', taskId,
    '--outcome', 'existing-canonical-retailer',
    '--canonical-slug', 'healthplus',
    '--rationale', common.rationale,
  ]);
  assert.equal(command.apply, false);
  assert.equal(command.resolution.outcome, 'existing-canonical-retailer');
  assert.throws(() => parseCommunityRetailerResearchResolutionCommand([
    '--task-id', taskId,
    '--outcome', 'ambiguous-retailer',
    '--canonical-slug', 'healthplus',
    '--rationale', common.rationale,
  ]), /not valid/);
});

test('the retailer resolution migration and writer cannot publish or alter commerce data', async () => {
  const root = process.cwd();
  const migration = await readFile(
    path.join(root, 'db/migrations/0030_community_research_workflow.sql'),
    'utf8',
  );
  const writer = await readFile(
    path.join(root, 'lib/community-intake/retailer-research-resolution.ts'),
    'utf8',
  );

  assert.match(migration, /community_retailer_research_resolutions/);
  assert.match(migration, /task_id uuid primary key/);
  assert.match(migration, /canonical_write = false/);
  assert.match(migration, /publication_status = 'private-research-only'/);
  assert.match(migration, /existing-canonical-retailer/);
  assert.doesNotMatch(writer, /\b(insert into|update)\s+(retailers|offers|products)\b/i);
});
