import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import publicCatalogueSearchArtifact from '@/data/public-catalogue-search.json';
import { catalogueSearchRetryAfterSeconds } from '@/lib/catalogue/catalogue-search-rate-limit-policy';
import { parsePublicCatalogueSearchArtifact } from '@/lib/catalogue/public-catalogue-search';

const root = process.cwd();
const sourceExtensions = ['', '.ts', '.tsx', '.json'];

async function existingSourcePath(candidate: string) {
  for (const extension of sourceExtensions) {
    const file = `${candidate}${extension}`;
    try {
      await readFile(file);
      return file;
    } catch {
      // Try the next supported source shape.
    }
  }
  for (const extension of ['.ts', '.tsx']) {
    const file = path.join(candidate, `index${extension}`);
    try {
      await readFile(file);
      return file;
    } catch {
      // Try the next supported source shape.
    }
  }
  return null;
}

async function localImportGraph(entry: string) {
  const seen = new Set<string>();
  const pending = [entry];
  const importPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (current.endsWith('.json')) continue;

    const source = await readFile(current, 'utf8');
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier || (!specifier.startsWith('@/') && !specifier.startsWith('.'))) continue;
      const unresolved = specifier.startsWith('@/')
        ? path.join(root, specifier.slice(2))
        : path.resolve(path.dirname(current), specifier);
      const resolved = await existingSourcePath(unresolved);
      if (resolved && resolved.startsWith(root)) pending.push(resolved);
    }
  }

  return seen;
}

test('the checked-in public search projection exposes only the approved minimum fields', () => {
  const artifact = parsePublicCatalogueSearchArtifact(publicCatalogueSearchArtifact);
  assert.equal(artifact.exposure, 'public-catalogue-search');
  assert.ok(artifact.products.length > 24);

  const allowedKeys = ['approvedGtin', 'brand', 'name', 'size', 'slug', 'source'];
  for (const product of artifact.products) {
    assert.deepEqual(Object.keys(product).sort(), allowedKeys);
    assert.match(product.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    if (product.approvedGtin) assert.match(product.approvedGtin, /^\d{8,14}$/);
  }

  assert.throws(
    () => parsePublicCatalogueSearchArtifact({
      ...artifact,
      products: [{ ...artifact.products[0], moderationNotes: 'private' }],
    }),
    /unexpected field|invalid/,
  );
});

test('the endpoint transitive source graph is isolated from private catalogue artifacts', async () => {
  const graph = await localImportGraph(
    path.join(root, 'app/api/products/suggestions/route.ts'),
  );
  const projectFiles = [...graph].map(file => path.relative(root, file).replaceAll(path.sep, '/'));
  assert.ok(projectFiles.includes('data/public-catalogue-search.json'));
  for (const privateBoundary of [
    'data/catalogue.ts',
    'data/catalogue-intake',
    'data/external-catalogue',
    'data/external-products',
    'data/published-intake-products',
    'data/catalogue-publication',
    'data/catalogue-research',
    'data/catalogue-discovery',
    'data/catalogue-identity',
  ]) {
    assert.equal(projectFiles.some(file => file.includes(privateBoundary)), false,
      `runtime source graph crossed private boundary: ${privateBoundary}`,
    );
  }
});

test('the public projection has a deterministic drift check in the release gate', async () => {
  const [packageSource, releaseSource, buildSource, bundleVerifier] = await Promise.all([
    readFile(path.join(root, 'package.json'), 'utf8'),
    readFile(path.join(root, 'scripts/verify-release.ts'), 'utf8'),
    readFile(path.join(root, 'scripts/vercel-build.ts'), 'utf8'),
    readFile(path.join(root, 'scripts/verify-public-catalogue-search-bundle.ts'), 'utf8'),
  ]);
  assert.match(packageSource, /"catalogue:search:build"/);
  assert.match(packageSource, /"catalogue:search:bundle:verify"/);
  assert.match(packageSource, /"catalogue:search:verify"/);
  assert.match(releaseSource, /Public catalogue search projection/);
  assert.match(buildSource, /step === 'build-next'[\s\S]*catalogue:search:bundle:verify/);
  assert.match(bundleVerifier, /tracePath = `\$\{routePath\}\.nft\.json`/);
  assert.match(bundleVerifier, /maximumTraceBytes/);
  assert.match(bundleVerifier, /private graph absent/);

  const verification = spawnSync(
    'npm',
    ['run', 'catalogue:search:verify'],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(
    verification.status,
    0,
    `${verification.stdout}\n${verification.stderr}`,
  );
  assert.match(verification.stdout, /Verified \d+ public catalogue search records/);
});

test('Neon search uses seeded indexed text and approved GTIN fields', async () => {
  const [migration, repository, seed] = await Promise.all([
    readFile(path.join(root, 'db/migrations/0029_public_catalogue_search.sql'), 'utf8'),
    readFile(path.join(root, 'lib/catalogue/catalogue-search-repository.ts'), 'utf8'),
    readFile(path.join(root, 'scripts/seed-catalogue.ts'), 'utf8'),
  ]);

  assert.match(migration, /approved_gtin/);
  assert.match(migration, /search_text/);
  assert.match(migration, /gin_trgm_ops/);
  assert.match(migration, /where is_published = true/i);
  assert.match(repository, /p\.search_text like \$\{pattern\}/);
  assert.match(repository, /p\.approved_gtin/);
  assert.doesNotMatch(repository, /lower\(concat_ws/);
  assert.match(seed, /public-catalogue-search\.json/);
  assert.match(seed, /publicCatalogueSearchText/);
  assert.match(seed, /approved_gtin/);
  assert.match(seed, /search_text/);
});

test('search reads are rate limited and remote-only searches show immediate feedback', async () => {
  const [route, security, client, styles] = await Promise.all([
    readFile(path.join(root, 'app/api/products/suggestions/route.ts'), 'utf8'),
    readFile(path.join(root, 'lib/catalogue/catalogue-search-security.ts'), 'utf8'),
    readFile(path.join(root, 'components/products/catalogue-search.tsx'), 'utf8'),
    readFile(path.join(root, 'components/products/catalogue-search.module.css'), 'utf8'),
  ]);

  assert.match(route, /status:\s*429/);
  assert.match(route, /Retry-After/);
  assert.match(route, /catalogueSearchRateLimit/);
  assert.match(security, /if \(!url && !token\)/);
  assert.match(security, /allowed:\s*true/);
  assert.match(security, /catch[\s\S]*allowed:\s*false/);
  assert.match(client, /matches\.length > 0 \|\| isLoading/);
  assert.match(client, /Finding matches/);
  assert.match(client, /loadingSuggestion/);
  assert.match(client, /response\.status === 429/);
  assert.match(client, /Search is taking a short pause\./);
  assert.match(client, /More results are not available right now\./);
  assert.match(client, /No close match yet\./);
  assert.match(client, /Search all products/);
  assert.match(client, /matches\.length > 0 \|\| isLoading \|\| Boolean\(remoteFeedback\)/);
  assert.match(styles, /\.loadingSuggestion/);
  assert.match(styles, /\.searchFallback/);
  assert.match(styles, /\.searchFallback a\s*\{[\s\S]*min-height:\s*2\.75rem/);

  assert.equal(catalogueSearchRetryAfterSeconds(Date.now() - 1_000), 1);
  assert.equal(catalogueSearchRetryAfterSeconds(Date.now() + 120_000), 60);
  assert.equal(catalogueSearchRetryAfterSeconds(undefined), 60);
});
