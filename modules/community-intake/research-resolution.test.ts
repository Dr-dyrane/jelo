import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parseCommunityResearchResolutionCommand } from '@/lib/community-intake/research-resolution-command';
import {
  buildCommunityProductResearchResolution,
  communityProductResearchResolutionSchema,
} from '@/lib/community-intake/research-resolution';

const taskId = '6b1629ce-b151-4ed6-b91d-b985a6d725d8';
const common = {
  taskId,
  reviewedBy: 'neon-auth|operator-1',
  rationale: 'Exact manufacturer identity matches the canonical record.',
};

test('an existing product resolution requires one canonical target and remains private', () => {
  assert.deepEqual(buildCommunityProductResearchResolution({
    ...common,
    outcome: 'existing-canonical-product',
    canonicalSlug: 'cosrx-salicylic-acid-daily-gentle-cleanser',
  }), {
    taskId,
    outcome: 'existing-canonical-product',
    canonicalProductSlug: 'cosrx-salicylic-acid-daily-gentle-cleanser',
    candidateId: null,
    reviewedBy: 'neon-auth|operator-1',
    rationale: 'Exact manufacturer identity matches the canonical record.',
    auditMetadata: {},
    canonicalWrite: false,
    publicationStatus: 'private-research-only',
    taskStatus: 'completed',
  });

  assert.throws(() => communityProductResearchResolutionSchema.parse({
    ...common,
    outcome: 'existing-canonical-product',
  }));
  assert.throws(() => communityProductResearchResolutionSchema.parse({
    ...common,
    outcome: 'existing-canonical-product',
    canonicalSlug: 'known-product',
    candidateId: 'unexpected-candidate',
  }));
});

test('a deliberate intake resolution records a handoff id without creating intake', () => {
  const row = buildCommunityProductResearchResolution({
    ...common,
    outcome: 'deliberate-intake-candidate',
    candidateId: 'street-labs-barrier-serum-30ml',
    auditMetadata: { evidencePacket: 'packet-123', exactIdentityReviewed: true },
  });
  assert.equal(row.candidateId, 'street-labs-barrier-serum-30ml');
  assert.equal(row.canonicalProductSlug, null);
  assert.equal(row.canonicalWrite, false);
  assert.equal(row.publicationStatus, 'private-research-only');
});

test('family and bundle outcomes reject catalogue targets', () => {
  for (const outcome of ['ambiguous-family', 'bundle'] as const) {
    assert.equal(buildCommunityProductResearchResolution({ ...common, outcome }).outcome, outcome);
    assert.throws(() => communityProductResearchResolutionSchema.parse({
      ...common,
      outcome,
      candidateId: 'should-not-be-accepted',
    }));
  }
});

test('a dismissed duplicate is terminal and can name at most one known target', () => {
  assert.equal(buildCommunityProductResearchResolution({
    ...common,
    outcome: 'dismissed-duplicate',
    canonicalSlug: 'known-product',
  }).taskStatus, 'dismissed');
  assert.throws(() => communityProductResearchResolutionSchema.parse({
    ...common,
    outcome: 'dismissed-duplicate',
    canonicalSlug: 'known-product',
    candidateId: 'known-candidate',
  }), /not both/);
});

test('the resolver command is dry-run by default and enforces outcome-specific targets', () => {
  const command = parseCommunityResearchResolutionCommand([
    '--task-id', taskId,
    '--outcome', 'deliberate-intake-candidate',
    '--candidate-id', 'street-labs-barrier-serum-30ml',
    '--rationale', 'Exact identity is ready for deliberate intake authoring.',
  ]);
  assert.equal(command.apply, false);
  assert.equal(command.resolution.outcome, 'deliberate-intake-candidate');
  assert.throws(() => parseCommunityResearchResolutionCommand([
    '--task-id', taskId,
    '--outcome', 'existing-canonical-product',
    '--rationale', 'Missing the exact canonical target.',
  ]));
  assert.throws(() => parseCommunityResearchResolutionCommand([
    '--task-id', taskId,
    '--outcome', 'bundle',
    '--candidate-id', 'silently-ignored-target',
    '--rationale', 'A bundle cannot become one SKU.',
  ]), /not valid/);
});

test('the migration is one resolution per product task and cannot grant publication', async () => {
  const root = process.cwd();
  const migration = await readFile(
    path.join(root, 'db/migrations/0023_community_research_resolutions.sql'),
    'utf8',
  );
  const writer = await readFile(
    path.join(root, 'lib/community-intake/research-resolution.ts'),
    'utf8',
  );
  const report = await readFile(
    path.join(root, 'scripts/report-community-research-signals.ts'),
    'utf8',
  );
  const repository = await readFile(
    path.join(root, 'lib/community-intake/repository.ts'),
    'utf8',
  );

  assert.match(migration, /task_id uuid primary key/);
  assert.match(migration, /entity_kind = 'product'/);
  assert.match(migration, /canonical_write = false/);
  assert.match(migration, /publication_status = 'private-research-only'/);
  assert.match(migration, /existing-canonical-product/);
  assert.match(migration, /deliberate-intake-candidate/);
  assert.match(migration, /ambiguous-family/);
  assert.match(migration, /dismissed-duplicate/);
  assert.match(report, /task\.status in \('pending', 'in-progress'\)/);
  assert.match(repository, /status in \('completed', 'dismissed'\)/);
  assert.doesNotMatch(writer, /\b(insert into|update)\s+(catalogue_intake|catalogue_publication|products|offers|product_images)\b/i);
});
