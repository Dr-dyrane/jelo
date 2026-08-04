import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { products } from '@/data/catalogue';
import publicCatalogueSearchArtifact from '@/data/public-catalogue-search.json';

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('0033 backfills one deterministic immutable version for each reviewed public product row', async () => {
  const migration = await source('db/migrations/0033_catalogue_product_identity_versions.sql');

  assert.match(migration, /^begin;/);
  assert.match(migration, /create table catalogue_product_identity_versions/);
  assert.match(migration, /product_id uuid not null unique references products\(id\) on delete restrict/);
  assert.match(migration, /unique \(identity_id, version_number\)/);
  assert.match(migration, /catalogue-product-identity-version:v1:' \|\| product\.id::text/);
  assert.match(migration, /catalogue-product-identity:v1:' \|\| product\.id::text/);
  assert.match(migration, /digest\([\s\S]*'sha256'/);
  assert.match(migration, /where product\.is_published = true/);
  assert.match(migration, /product\.source_version in \('static-v1', 'published-intake-v1'\)/);
  assert.match(migration, /on conflict \(product_id\) do nothing/);
  assert.match(migration, /Catalogue identity version history is append-only/);
  assert.doesNotMatch(migration, /on delete cascade/i);
  assert.match(migration, /commit;\s*$/);
});

test('0033 preserves tombstones and rejects silent size, lifecycle, or transition rewrites', async () => {
  const migration = await source('db/migrations/0033_catalogue_product_identity_versions.sql');

  assert.match(migration, /before update of is_published, size on products/);
  assert.match(migration, /A material size change requires a new catalogue identity version/);
  assert.match(migration, /old\.is_published = true and new\.is_published = false/);
  assert.match(migration, /retirement_reason_category = 'catalogue_projection_retirement'/);
  assert.match(migration, /from_identity_version_id uuid primary key/);
  assert.match(migration, /transition_kind catalogue_identity_transition_kind/);
  assert.match(migration, /Catalogue identity transition cycles are prohibited/);
  assert.match(migration, /Catalogue identity transitions are append-only/);
});

test('0033 and the seed admit only the reviewed public projection and reconcile repeat runs', async () => {
  const [migration, seed, repository] = await Promise.all([
    source('db/migrations/0033_catalogue_product_identity_versions.sql'),
    source('scripts/seed-catalogue.ts'),
    source('lib/catalogue/repository.ts'),
  ]);

  assert.match(migration, /Catalogue identity versions require a public catalogue product/);
  assert.match(migration, /catalogue_identity_public_authority_check/);
  assert.match(seed, /catalogueIdentityIdForProductId\(savedProduct\.id\)/);
  assert.match(seed, /catalogueIdentityVersionIdForProductId\([\s\S]*savedProduct\.id/);
  assert.match(seed, /insert into catalogue_product_identity_versions/);
  assert.match(seed, /on conflict \(product_id\) do nothing/);
  assert.match(seed, /Reviewed identity\/version reconciliation failed/);
  assert.match(repository, /deliberately has no static, intake, moderation, or external-candidate/);
  assert.match(repository, /from catalogue_product_identity_versions version/);
  assert.doesNotMatch(repository, /external-products\.json/);
});

test('the complete current reviewed catalogue remains a one-to-one projection', () => {
  assert.equal(publicCatalogueSearchArtifact.products.length, products.length);
  assert.equal(new Set(products.map(product => product.slug)).size, products.length);
  assert.equal(
    new Set(publicCatalogueSearchArtifact.products.map(product => product.slug)).size,
    publicCatalogueSearchArtifact.products.length,
  );
  assert.deepEqual(
    new Set(products.map(product => product.slug)),
    new Set(publicCatalogueSearchArtifact.products.map(product => product.slug)),
  );
});
