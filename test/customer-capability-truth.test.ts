import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { customerCapabilities } from '@/lib/customer/customer-capabilities';

function readDoc(path: string): string {
  return readFileSync(path, 'utf8');
}

test('the customer capability contract is the single shipped-state baseline', () => {
  // The contract must exist and have the expected shape.
  assert.ok(typeof customerCapabilities.shelfPersistence === 'boolean');
  assert.ok(typeof customerCapabilities.routinePersistence === 'boolean');
  assert.ok(typeof customerCapabilities.privateProductRequests === 'boolean');
  assert.ok(typeof customerCapabilities.completeExploreProjection === 'boolean');
  assert.ok(typeof customerCapabilities.customerConcerns === 'boolean');
  assert.ok(typeof customerCapabilities.authenticatedGuidance === 'boolean');
});

test('JELOCARE_ME.md does not claim Routine persistence is missing', () => {
  const doc = readDoc('docs/product/JELOCARE_ME.md');
  // Routine persistence ships — the doc must not say it is unpersisted.
  assert.doesNotMatch(doc, /Routine.*remain.*unpersisted/i);
  assert.doesNotMatch(doc, /Routine.*not.*persistence/i);
});

test('JELOCARE_ME.md does not claim Explore has a fixed cap', () => {
  const doc = readDoc('docs/product/JELOCARE_ME.md');
  assert.doesNotMatch(doc, /at most 12/i);
  assert.doesNotMatch(doc, /Explore currently renders at most/i);
});

test('JELOCARE_ME.md does not claim no /contribute helper exists', () => {
  const doc = readDoc('docs/product/JELOCARE_ME.md');
  assert.doesNotMatch(doc, /no.*helper.*links.*contribute/i);
});

test('the product roadmap does not claim Shelf/Routine persistence is missing', () => {
  const doc = readDoc('docs/product/ROADMAP.md');
  assert.doesNotMatch(doc, /Shelf\/Routine persistence.*do not ship/i);
  assert.doesNotMatch(doc, /Explore currently renders at most 12/i);
});

test('the dock rollback section does not claim the primitive is unused', () => {
  const doc = readDoc('docs/design/ADAPTIVE_WORKSPACE_DOCK.md');
  assert.doesNotMatch(doc, /unused by production routes/i);
});

test('the production roadmap Routine row reflects shipped persistence', () => {
  const doc = readDoc('docs/product/JELOCARE_ME_PRODUCTION_ROADMAP.md');
  // The Routine row must not say "truthful empty state" as its shipped truth.
  assert.doesNotMatch(doc, /Routine.*truthful empty state.*development presentation/);
});

test('the capability contract is linked from the key documents', () => {
  const contractPath = 'lib/customer/customer-capabilities.ts';
  const docs = [
    'docs/adr/0014-customer-shelf-data-boundary.md',
    'docs/product/JELOCARE_ME.md',
    'docs/product/ROADMAP.md',
  ];
  for (const docPath of docs) {
    const doc = readDoc(docPath);
    assert.ok(
      doc.includes(contractPath),
      `${docPath} must link to ${contractPath}`,
    );
  }
});
