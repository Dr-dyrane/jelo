import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { LEGACY_SHELF_IMPORT_MANIFEST } from '../../lib/customer/legacy-shelf-import-manifest';
import {
  canEditProductRequestIdentity,
  canManageProductRequestPhoto,
  canRevokeProductRequestPhotoConsent,
  createProductRequestFields,
  findExactCanonicalIdentity,
  MUTED_PRODUCT_REQUEST_STATES,
  PRODUCT_REQUEST_FIELD_LIMITS,
  retryKeyFor,
  searchCanonicalIdentities,
  validateProductRequestFields,
  type ProductRequest,
} from '../../components/me/product-requests/product-request-model';
import type { CustomerPortalProduct } from '../../lib/customer/portal-model';

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), 'utf8');

function resolveWorkspaceImport(importer: string, specifier: string) {
  if (!specifier.startsWith('@/') && !specifier.startsWith('.')) return null;
  const base = specifier.startsWith('@/')
    ? join(root, specifier.slice(2))
    : resolve(dirname(importer), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

function runtimeImports(path: string) {
  const text = readFileSync(path, 'utf8');
  if (/^['"]use server['"];|^import 'server-only';/m.test(text)) return [];
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  return file.statements.flatMap((statement) => {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) return [];
      if (
        clause
        && !clause.name
        && clause.namedBindings
        && ts.isNamedImports(clause.namedBindings)
        && clause.namedBindings.elements.every(element => element.isTypeOnly)
      ) return [];
      return ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [];
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      if (statement.isTypeOnly) return [];
      if (
        statement.exportClause
        && ts.isNamedExports(statement.exportClause)
        && statement.exportClause.elements.every(element => element.isTypeOnly)
      ) return [];
      return ts.isStringLiteral(statement.moduleSpecifier)
        ? [statement.moduleSpecifier.text]
        : [];
    }
    return [];
  });
}

function productionClientGraph(entry: string) {
  const pending = [join(root, entry)];
  const visited = new Set<string>();
  while (pending.length) {
    const path = pending.pop()!;
    if (visited.has(path)) continue;
    visited.add(path);
    for (const specifier of runtimeImports(path)) {
      const dependency = resolveWorkspaceImport(path, specifier);
      if (dependency && !visited.has(dependency)) pending.push(dependency);
    }
  }
  return visited;
}

const products: readonly CustomerPortalProduct[] = [
  {
    slug: 'anua-niacinamide-serum-30ml',
    brand: 'ANUA',
    name: 'Niacinamide 10% + TXA 4% Serum',
    size: '30 ml',
    category: 'Face',
    step: 'Treat',
    image: '/product-placeholder.svg',
    displayLine: 'Reviewed product',
    usage: 'As directed',
    priceLabel: null,
    supportedConcernSlugs: [],
    freshExactRetailerNames: [],
  },
];

describe('private missing-product presentation model', () => {
  it('accepts only an exact canonical identity alias before opening the request path', () => {
    assert.equal(
      findExactCanonicalIdentity(products, 'ANUA Niacinamide 10% + TXA 4% Serum 30 ml')?.slug,
      products[0].slug,
    );
    assert.equal(findExactCanonicalIdentity(products, 'anua niacinamide serum'), undefined);
    assert.deepEqual(searchCanonicalIdentities(products, 'anua 30 ml'), products);
  });

  it('offers every partial canonical match as a Shelf add before a missing-product request', () => {
    assert.deepEqual(searchCanonicalIdentities(products, 'anua 30 ml'), products);
    assert.deepEqual(searchCanonicalIdentities(products, 'not in catalogue'), []);

    const fields = source('components/me/product-requests/product-request-fields.tsx');
    const controller = source('components/me/product-requests/use-product-request-add.ts');
    const page = source('components/me/product-requests/product-request-add-page.tsx');
    assert.match(fields, /matches\.map\([\s\S]*<ShelfActionButton[\s\S]*productSlug=\{product\.slug\}/);
    assert.doesNotMatch(fields, /\{isExact \? \([\s\S]*<ShelfActionButton/);
    assert.match(fields, /const saved = viewModel\.shelf\.some/);
    assert.doesNotMatch(fields, /productRequestPresentation|requests\.some/);
    assert.match(controller, /canonicalMatches\.length === 0/);
    assert.match(controller, /searchCanonicalIdentities\(viewModel\.catalogue \?\? \[\], value\)\.length/);
    assert.match(page, />Request this missing product</);
  });

  it('defaults photo-identification consent off and validates required identity fields', () => {
    const empty = createProductRequestFields();
    assert.equal(empty.photoIdentificationConsent, false);
    assert.equal(PRODUCT_REQUEST_FIELD_LIMITS.photoBytes, 4 * 1024 * 1024);
    assert.equal(validateProductRequestFields(empty), 'Enter the brand printed on the pack.');
    assert.equal(validateProductRequestFields({
      ...empty,
      brand: 'Example',
      fullPackName: 'Full pack name',
      printedSizeVariant: '250 ml',
      sourceUrl: 'https://retailer.example/product',
    }), null);
  });

  it('reuses a retry key only for the same mutation fingerprint', () => {
    let sequence = 0;
    const createKey = () => `key-${++sequence}`;
    const first = retryKeyFor(null, { revision: 2, submit: true }, createKey);
    const retry = retryKeyFor(first, { submit: true, revision: 2 }, createKey);
    const changed = retryKeyFor(retry, { revision: 3, submit: true }, createKey);
    assert.equal(retry.idempotencyKey, first.idempotencyKey);
    assert.notEqual(changed.idempotencyKey, first.idempotencyKey);
  });

  it('mutes only active research-wait states', () => {
    assert.deepEqual([...MUTED_PRODUCT_REQUEST_STATES], ['pending', 'in_review', 'needs_info']);
  });
});

describe('private request /me contract', () => {
  it('prepares the reviewed five plus nine preview on the development server boundary', () => {
    assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.accepted.length, 5);
    assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.length, 9);
    const route = source('app/(customer)/me/[...route]/page.ts');
    const fixture = source('lib/customer/legacy-product-request-fixture.ts');
    const shelf = source('components/me/product-requests/product-request-shelf.tsx');
    const detail = source('components/me/product-requests/use-product-request-detail.ts');
    assert.match(fixture, /^import 'server-only'/);
    assert.match(fixture, /process\.env\.NODE_ENV !== 'development'/);
    assert.match(fixture, /createSyntheticProductRequestPresentation/);
    assert.match(route, /await import\('@\/lib\/customer\/legacy-product-request-fixture'\)/);
    assert.match(route, /productRequestPresentation/);
    assert.match(shelf, /initialRequests/);
    assert.match(detail, /initialRequest/);
    assert.doesNotMatch(shelf, /SYNTHETIC_LEGACY_PRODUCT_REQUESTS|legacy-product-request-fixture|legacy-shelf-import-manifest/);
    assert.doesNotMatch(detail, /SYNTHETIC_LEGACY_PRODUCT_REQUESTS|legacy-product-request-fixture|legacy-shelf-import-manifest/);
    assert.doesNotMatch(shelf, /Bright \+ Clear|Rinse Me Out|DISAAR/);
  });

  it('keeps the legacy manifest and private fixture outside the production client graph', () => {
    const graph = productionClientGraph('components/me/home/me-home.tsx');
    const relativePaths = [...graph].map(path => path.slice(root.length + 1));
    assert.ok(relativePaths.includes('components/me/product-requests/product-request-shelf.tsx'));
    assert.ok(relativePaths.includes('components/me/product-requests/use-product-request-detail.ts'));
    assert.ok(!relativePaths.includes('lib/customer/legacy-product-request-fixture.ts'));
    assert.ok(!relativePaths.includes('lib/customer/legacy-shelf-import-manifest.ts'));
    for (const path of graph) {
      assert.doesNotMatch(
        readFileSync(path, 'utf8'),
        /SYNTHETIC_LEGACY_PRODUCT_REQUESTS|legacy-product-request-fixture|legacy-shelf-import-manifest/,
        path,
      );
    }
  });

  it('keeps add and request detail as Shelf-owned stack routes', () => {
    const routes = source('app/(customer)/me/[...route]/page.ts');
    const shell = source('components/me/shell/me-shell-model.ts');
    assert.match(routes, /parts\[0\] === 'shelf' && parts\[1\] === 'add'/);
    assert.match(routes, /parts\[0\] === 'shelf' && parts\[1\] === 'request'/);
    assert.match(shell, /route\.kind === 'shelf-add' \|\| route\.kind === 'shelf-request'/);
    assert.match(shell, /'shelf-add'[\s\S]*href: '\/me\/shelf\/add'/);
  });

  it('uses one shell FAB registry and keeps the barrel component thin', () => {
    const portal = source('components/me/home/me-home.tsx');
    const barrel = source('components/me/product-requests/product-request-experience.tsx');
    assert.equal(portal.match(/useWorkspaceDockFabRegistration\(/g)?.length, 1);
    assert.match(portal, /route\.kind === 'shelf-add'[\s\S]*'\/me\/shelf\/add'/);
    assert.equal(barrel.trim().split('\n').length, 3);
  });

  it('keeps upload and consent separate and exposes photo replacement and removal', () => {
    const fields = source('components/me/product-requests/product-request-fields.tsx');
    const detail = source('components/me/product-requests/product-request-detail-sections.tsx');
    assert.match(fields, /type="file"/);
    assert.match(fields, /type="checkbox"/);
    assert.match(fields, /Uploading a photo does not grant this permission/);
    assert.match(fields, /up to 4 MB/);
    assert.match(fields, /4 MB or smaller/);
    assert.doesNotMatch(fields, /8 MB|under 4 MB/);
    assert.match(detail, /replacePhoto/);
    assert.match(detail, /removePhoto/);
  });

  it('confirms destructive deletion with identity, consequences, and modal focus semantics', () => {
    const detail = source('components/me/product-requests/product-request-delete-dialog.tsx');
    const controller = source('components/me/product-requests/use-product-request-detail.ts');
    const modal = source('components/ui/use-modal-dialog.ts');
    assert.match(detail, /useModalDialog/);
    assert.match(detail, /<dialog[\s\S]*aria-labelledby="delete-product-request-title"/);
    assert.match(detail, /ref=\{triggerRef\}/);
    assert.match(detail, /onCancel=[\s\S]*close\(\)/);
    assert.match(detail, /Brand[\s\S]*request\.brand/);
    assert.match(detail, /Full pack name[\s\S]*request\.fullPackName/);
    assert.match(detail, /Printed size or variant[\s\S]*request\.printedSizeVariant/);
    assert.match(detail, /Remove it from your Shelf/);
    assert.match(detail, /Withdraw its research demand/);
    assert.match(detail, /Delete any private photo attached to it/);
    assert.match(detail, />Cancel</);
    assert.match(detail, /> Delete\s*</);
    assert.match(detail, /function confirmDelete\(\)[\s\S]*onConfirm\(\)/);
    assert.doesNotMatch(detail, />\s*Back\s*</);
    assert.doesNotMatch(controller, /window\.confirm\('Delete this private product request/);
    assert.match(modal, /trigger\.focus\(\{ preventScroll: true \}\)/);
    assert.match(modal, /event\.key === 'Escape'/);
    assert.match(modal, /event\.key !== 'Tab'/);
  });

  it('limits identity and photo edits while allowing consent-only revocation through published', () => {
    const base: ProductRequest = {
      id: '00000000-0000-4000-8000-000000000099',
      revision: 3,
      lifecycleState: 'draft',
      brand: 'Example',
      fullPackName: 'Example pack',
      printedSizeVariant: '50 ml',
      category: null,
      retailerLabel: null,
      sourceUrl: null,
      origin: 'customer',
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
      submittedAt: null,
      normalizedEntityRef: 'custom:example:0000000000000000',
      matchedIdentityVersionId: null,
      photo: { present: true, identificationConsent: true },
    };
    const states = ['draft', 'pending', 'in_review', 'needs_info', 'matched', 'published', 'withdrawn'] as const;
    assert.deepEqual(
      states.filter(lifecycleState => canEditProductRequestIdentity({ ...base, lifecycleState })),
      ['draft', 'pending', 'needs_info'],
    );
    assert.deepEqual(
      states.filter(lifecycleState => canManageProductRequestPhoto({ ...base, lifecycleState })),
      ['draft', 'pending', 'in_review', 'needs_info', 'matched'],
    );
    assert.deepEqual(
      states.filter(lifecycleState => canRevokeProductRequestPhotoConsent({ ...base, lifecycleState })),
      ['draft', 'pending', 'in_review', 'needs_info', 'matched', 'published'],
    );
    assert.equal(canRevokeProductRequestPhotoConsent({
      ...base,
      photo: { ...base.photo, identificationConsent: false },
    }), false);

    const controller = source('components/me/product-requests/use-product-request-detail.ts');
    const revocation = controller.slice(
      controller.indexOf('function revokePhotoConsent'),
      controller.indexOf('function removeRequest'),
    );
    assert.match(revocation, /photoIdentificationConsent: false/);
    assert.doesNotMatch(revocation, /brand|fullPackName|printedSizeVariant|sourceUrl/);
  });

  it('keeps request API calls on the private owner-scoped endpoints', () => {
    const api = source('components/me/product-requests/product-request-api.ts');
    assert.match(api, /'\/api\/me\/product-requests'/);
    assert.match(api, /\/api\/me\/product-requests\/\$\{encodeURIComponent\(id\)\}\/image/);
    assert.match(api, /REVISION_CONFLICT|code/);
  });
});
