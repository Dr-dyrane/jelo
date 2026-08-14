import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { products } from '../../data/catalogue';
import type { CustomerAccessIdentity } from '../../lib/customer/access-policy';
import {
  resolveCustomerPortalShelfItem,
  type CustomerPortalProduct,
} from '../../lib/customer/portal-model';
import {
  createCustomerShelfService,
} from '../../lib/customer/shelf-policy';
import type {
  CustomerShelfRecord,
  CustomerShelfRepository,
} from '../../lib/customer/shelf-repository';
import { LEGACY_SHELF_IMPORT_MANIFEST } from '../../lib/customer/legacy-shelf-import-manifest';
import {
  LEGACY_SHELF_OWNER_SUBJECT_ENV,
  parseLegacyShelfImportOptions,
  targetImportReceiptSha256,
} from '../../lib/customer/legacy-shelf-import-policy';
import { verifyLegacyShelfImportSourceSnapshot } from '../../lib/customer/legacy-shelf-import-source';
import {
  isCustomerShelfRoleAttestationSafe,
  type CustomerShelfRoleAttestation,
} from '../../lib/customer/shelf-role-attestation';

const identity = (subject: string, source: CustomerAccessIdentity['source'] = 'session'): CustomerAccessIdentity => ({
  subject,
  email: null,
  emailVerified: true,
  name: 'Ada Umeh',
  displayName: 'Ada',
  preferredFirstName: 'Ada',
  source,
});

const versionId = '11111111-1111-4111-8111-111111111111';
const slug = 'exact-product';
const repositoryRoot = process.cwd();

function workspaceSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return workspaceSourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function resolveWorkspaceImport(importer: string, specifier: string) {
  if (!specifier.startsWith('@/') && !specifier.startsWith('.')) return null;
  const base = specifier.startsWith('@/')
    ? join(repositoryRoot, specifier.slice(2))
    : resolve(dirname(importer), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.server.ts`,
    `${base}.server.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (/\.tsx?$/.test(candidate) && existsSync(candidate)) return candidate;
  }
  return null;
}

function runtimeImports(path: string) {
  const text = readFileSync(path, 'utf8');
  if (/^['"]use server['"];|^import 'server-only';/m.test(text)) return [];
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  return file.statements.flatMap(statement => {
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

function productionClientGraph() {
  const sourceFiles = ['app', 'components', 'lib'].flatMap(directory => (
    workspaceSourceFiles(join(repositoryRoot, directory))
  ));
  const pending = sourceFiles.filter(path => /^['"]use client['"];/m.test(readFileSync(path, 'utf8')));
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

function record(overrides: Partial<CustomerShelfRecord> = {}): CustomerShelfRecord {
  return {
    identityVersionId: versionId,
    savedAt: '2026-08-03T12:00:00.000Z',
    saveOrigin: 'customer',
    lifecycleState: 'active',
    snapshot: {
      slug,
      brand: 'Exact Brand',
      name: 'Exact Product',
      size: '30 ml',
      versionNumber: 1,
      packageVersion: 'reviewed-baseline-v1:static-v1',
      formulaVersion: 'reviewed-baseline-v1:static-v1',
    },
    currentSlug: slug,
    currentProductPublished: true,
    ...overrides,
  };
}

function memoryRepository() {
  const rows = new Map<string, Map<string, CustomerShelfRecord>>();
  let calls = 0;
  const ownerRows = (owner: string) => {
    let owned = rows.get(owner);
    if (!owned) {
      owned = new Map();
      rows.set(owner, owned);
    }
    return owned;
  };
  const repository: CustomerShelfRepository = {
    async list(owner) {
      calls += 1;
      return [...ownerRows(owner).values()];
    },
    async count(owner) {
      calls += 1;
      return ownerRows(owner).size;
    },
    async contextForProduct(owner, productSlug) {
      calls += 1;
      return [...ownerRows(owner).values()].filter(
        item => item.snapshot.slug === productSlug || item.currentSlug === productSlug,
      );
    },
    async addCurrentBySlug(owner, productSlug) {
      calls += 1;
      if (productSlug !== slug) return 'unavailable';
      const owned = ownerRows(owner);
      if (owned.has(versionId)) return 'already_saved';
      owned.set(versionId, record());
      return 'added';
    },
    async remove(owner, identityVersionId) {
      calls += 1;
      return ownerRows(owner).delete(identityVersionId) ? 'removed' : 'already_removed';
    },
    async clear(owner) {
      calls += 1;
      const owned = ownerRows(owner);
      const count = owned.size;
      owned.clear();
      return count;
    },
  };
  return { repository, rows, calls: () => calls };
}

test('two owners stay isolated and add/remove retries are idempotent', async () => {
  const memory = memoryRepository();
  const service = createCustomerShelfService(memory.repository);
  const ada = identity('customer:ada');
  const bea = identity('customer:bea');

  assert.equal((await service.add(ada, slug)).status, 'saved');
  assert.equal((await service.add(ada, slug)).status, 'already_saved');
  assert.equal((await service.read(ada)).items.length, 1);
  assert.equal((await service.read(bea)).items.length, 0);

  assert.equal((await service.remove(bea, versionId)).status, 'already_removed');
  assert.equal((await service.read(ada)).items.length, 1);
  assert.equal((await service.remove(ada, versionId)).status, 'removed');
  assert.equal((await service.remove(ada, versionId)).status, 'already_removed');
  assert.equal((await service.read(ada)).items.length, 0);
});

test('missing owners and synthetic development fail closed without repository work', async () => {
  const memory = memoryRepository();
  const service = createCustomerShelfService(memory.repository);

  assert.equal((await service.read(identity(''))).status, 'unavailable');
  assert.equal((await service.add(identity(''), slug)).status, 'error');
  assert.equal((await service.read(identity('synthetic', 'synthetic-development'))).status, 'unavailable');
  assert.equal((await service.add(identity('synthetic', 'synthetic-development'), slug)).status, 'error');
  assert.equal(memory.calls(), 0);
});

test('active identities resolve while retired, changed, and unmatched snapshots stay removable', () => {
  const product: CustomerPortalProduct = {
    slug,
    brand: 'Exact Brand',
    name: 'Exact Product',
    size: '30 ml',
    category: 'Face',
    step: 'Treat',
    image: '/exact.png',
    displayLine: 'Treat · support',
    usage: 'Use as directed.',
    priceLabel: null,
    supportedConcernSlugs: [],
    freshExactRetailerNames: [],
  };
  const catalogue = new Map([[slug, product]]);

  assert.equal(resolveCustomerPortalShelfItem(record(), catalogue).product, product);
  const retired = resolveCustomerPortalShelfItem(record({ lifecycleState: 'retired' }), catalogue);
  assert.equal(retired.availability, 'unavailable');
  assert.equal(retired.product, null);
  assert.equal(retired.identityVersionId, versionId);
  const changed = resolveCustomerPortalShelfItem(record({ lifecycleState: 'superseded' }), catalogue);
  assert.equal(changed.availability, 'changed');
  assert.match(changed.message ?? '', /changed/i);
  const unmatched = resolveCustomerPortalShelfItem(record({ currentSlug: 'missing' }), catalogue);
  assert.equal(unmatched.availability, 'unavailable');
  assert.equal(unmatched.snapshot.name, 'Exact Product');
});

test('unavailable Shelf rows retain their immutable removal action and accessible identity', () => {
  const sharedViews = readFileSync('components/me/home/shared-views.tsx', 'utf8');
  const home = readFileSync('components/me/home/me-home.tsx', 'utf8');
  const button = readFileSync('components/me/shelf/shelf-action-button.tsx', 'utf8');
  assert.match(sharedViews, /function UnavailableShelfCard\([\s\S]*shelfItem=\{item\}/);
  assert.match(home, /<UnavailableShelfCard[\s\S]*shelfAction=\{shelfAction\}[\s\S]*onSettled=\{onShelfMutation\}/);
  assert.match(button, /identityVersionId: shelfItem\.identityVersionId/);
  assert.match(button, /Remove \$\{shelfItem\.snapshot\.brand\} \$\{shelfItem\.snapshot\.name\} from Shelf/);
  assert.match(button, /aria-live="polite"/);
});

test('migration and repository enforce RLS plus explicit owner predicates', () => {
  const migration = readFileSync('db/migrations/0034_customer_shelf.sql', 'utf8');
  const roleMigration = readFileSync('db/migrations/0035_runtime_database_roles.sql', 'utf8');
  const repository = readFileSync('lib/customer/shelf-repository.ts', 'utf8');
  const database = readFileSync('lib/customer/shelf-database.ts', 'utf8');
  assert.match(migration, /primary key \(owner_subject, product_identity_version_id\)/i);
  assert.match(migration, /references catalogue_product_identity_versions\(identity_version_id\) on delete restrict/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /current_setting\('app\.customer_subject', true\)/g);
  assert.match(repository, /set_config\('app\.customer_subject', \$\{owner\}, true\)/);
  assert.match(repository, /where item\.owner_subject = \$\{owner\}/);
  assert.match(repository, /where owner_subject = \$\{owner\}[\s\S]*product_identity_version_id = \$\{versionId\}/);
  assert.match(repository, /on conflict \(owner_subject, product_identity_version_id\) do nothing/);
  assert.match(database, /process\.env\.CUSTOMER_SHELF_DATABASE_URL/);
  assert.doesNotMatch(database, /DATABASE_URL\s*\?\?|POSTGRES_URL/);
  assert.match(database, /rolbypassrl/);
  assert.match(database, /rolsuper/);
  assert.match(database, /current_user = \$\{CUSTOMER_SHELF_RUNTIME_ROLE\}/);
  assert.match(database, /session_user = \$\{CUSTOMER_SHELF_RUNTIME_ROLE\}/);
  assert.match(database, /rolcanlogin/);
  assert.match(database, /rolinherit/);
  assert.match(database, /rolcreatedb/);
  assert.match(database, /rolcreaterole/);
  assert.match(database, /rolreplication/);
  assert.match(database, /pg_auth_members/);
  assert.match(database, /owned_relation\.relowner/);
  assert.match(database, /relrowsecurity/);
  assert.match(database, /relforcerowsecurity/);
  assert.match(database, /Customer Shelf database access is unavailable\./);
  assert.match(repository, /assertCustomerShelfRlsRole\(transaction\)/g);
  assert.match(repository, /pg_catalog\.set_config\('search_path', 'pg_catalog, public', true\)/g);
  assert.match(repository, /from public\.customer_shelf_items/);
  assert.match(repository, /with candidate as materialized/);
  assert.doesNotMatch(repository, /for (?:no key )?(?:share|update)/i);

  assert.match(roleMigration, /'jelocare_app_runtime'/);
  assert.match(roleMigration, /'jelocare_shelf_runtime'/);
  assert.match(roleMigration, /not runtime_role\.rolcanlogin[\s\S]*runtime_role\.rolinherit[\s\S]*runtime_role\.rolbypassrls/);
  assert.match(roleMigration, /membership\.member = runtime_role\.oid/);
  assert.doesNotMatch(roleMigration, /membership\.roleid = runtime_role\.oid/);
  assert.match(roleMigration, /relation\.relowner = runtime_role\.oid/);
  assert.match(roleMigration, /alter role jelocare_shelf_runtime set search_path to pg_catalog, public/);
  assert.match(roleMigration, /grant connect on database %I to jelocare_app_runtime, jelocare_shelf_runtime/);
  assert.match(roleMigration, /grant select, insert, update, delete on all tables in schema public to jelocare_app_runtime/);
  assert.match(roleMigration, /grant usage, select, update on all sequences in schema public to jelocare_app_runtime/);
  assert.match(roleMigration, /revoke all privileges on table public\.customer_shelf_items from jelocare_app_runtime/);
  assert.match(roleMigration, /revoke all privileges on table public\.customer_shelf_import_receipts from jelocare_app_runtime/);
  assert.match(roleMigration, /revoke all privileges on table public\.schema_migrations from jelocare_app_runtime/);
  assert.match(roleMigration, /grant usage on type public\.customer_shelf_save_origin to jelocare_shelf_runtime/);
  assert.match(roleMigration, /grant usage on type public\.catalogue_identity_lifecycle_state to jelocare_shelf_runtime/);
  assert.match(roleMigration, /grant select, insert, delete on table public\.customer_shelf_items to jelocare_shelf_runtime/);
  assert.match(roleMigration, /grant select \([\s\S]*identity_version_id[\s\S]*formula_version_at_review[\s\S]*\) on table public\.catalogue_product_identity_versions/);
  assert.match(roleMigration, /grant select \([\s\S]*id,[\s\S]*slug,[\s\S]*is_published[\s\S]*\) on table public\.products/);
  assert.doesNotMatch(
    roleMigration,
    /grant\s+update(?:\s*\([^;]*\))?\s+on\s+(?:table\s+)?public\.(?:catalogue_product_identity_versions|products)\s+to\s+jelocare_shelf_runtime/i,
  );
  assert.doesNotMatch(roleMigration, /alter default privileges/i);
});

test('Shelf role attestation rejects every elevated or indirect authority path', () => {
  const safe: CustomerShelfRoleAttestation = {
    current_role_is_exact: true,
    session_role_is_exact: true,
    rolcanlogin: true,
    rolinherit: false,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolreplication: false,
    rolbypassrls: false,
    has_role_memberships: false,
    owns_relations: false,
    relrowsecurity: true,
    relforcerowsecurity: true,
    requests_relrowsecurity: true,
    requests_relforcerowsecurity: true,
    images_relrowsecurity: true,
    images_relforcerowsecurity: true,
    mutations_relrowsecurity: true,
    mutations_relforcerowsecurity: true,
    cleanup_relrowsecurity: true,
    cleanup_relforcerowsecurity: true,
    requests_shelf_privileges_exact: true,
    images_shelf_privileges_exact: true,
    mutations_shelf_privileges_exact: true,
    cleanup_shelf_privileges_exact: true,
    requests_app_privileges: false,
    images_app_privileges: false,
    mutations_app_privileges: false,
    cleanup_app_privileges: false,
    requests_public_privileges: false,
    images_public_privileges: false,
    mutations_public_privileges: false,
    cleanup_public_privileges: false,
    routines_relrowsecurity: true,
    routines_relforcerowsecurity: true,
    routine_steps_relrowsecurity: true,
    routine_steps_relforcerowsecurity: true,
    routines_shelf_privileges_exact: true,
    routine_steps_shelf_privileges_exact: true,
    routines_app_privileges: false,
    routine_steps_app_privileges: false,
    routines_public_privileges: false,
    routine_steps_public_privileges: false,
    research_mentions_shelf_privileges: false,
    research_mentions_app_privileges_exact: true,
    research_mentions_public_privileges: false,
    signal_bridge_is_security_definer: true,
    signal_bridge_search_path_is_pinned: true,
    signal_bridge_public_execute: false,
    signal_bridge_app_execute: false,
    signal_bridge_shelf_execute: true,
    signal_bridge_shelf_execute_grant_option: false,
  };
  assert.equal(isCustomerShelfRoleAttestationSafe(safe), true);
  assert.equal(isCustomerShelfRoleAttestationSafe(undefined), false);
  for (const key of [
    'current_role_is_exact',
    'session_role_is_exact',
    'rolcanlogin',
    'relrowsecurity',
    'relforcerowsecurity',
    'requests_relrowsecurity',
    'requests_relforcerowsecurity',
    'images_relrowsecurity',
    'images_relforcerowsecurity',
    'mutations_relrowsecurity',
    'mutations_relforcerowsecurity',
    'cleanup_relrowsecurity',
    'cleanup_relforcerowsecurity',
    'requests_shelf_privileges_exact',
    'images_shelf_privileges_exact',
    'mutations_shelf_privileges_exact',
    'cleanup_shelf_privileges_exact',
    'routines_relrowsecurity',
    'routines_relforcerowsecurity',
    'routine_steps_relrowsecurity',
    'routine_steps_relforcerowsecurity',
    'routines_shelf_privileges_exact',
    'routine_steps_shelf_privileges_exact',
    'research_mentions_app_privileges_exact',
    'signal_bridge_is_security_definer',
    'signal_bridge_search_path_is_pinned',
    'signal_bridge_shelf_execute',
  ] as const) {
    assert.equal(isCustomerShelfRoleAttestationSafe({ ...safe, [key]: false }), false, key);
  }
  for (const key of [
    'rolinherit',
    'rolsuper',
    'rolcreatedb',
    'rolcreaterole',
    'rolreplication',
    'rolbypassrls',
    'has_role_memberships',
    'owns_relations',
    'requests_app_privileges',
    'images_app_privileges',
    'mutations_app_privileges',
    'cleanup_app_privileges',
    'requests_public_privileges',
    'images_public_privileges',
    'mutations_public_privileges',
    'cleanup_public_privileges',
    'research_mentions_shelf_privileges',
    'research_mentions_public_privileges',
    'signal_bridge_public_execute',
    'signal_bridge_app_execute',
    'signal_bridge_shelf_execute_grant_option',
    'routines_app_privileges',
    'routine_steps_app_privileges',
    'routines_public_privileges',
    'routine_steps_public_privileges',
  ] as const) {
    assert.equal(isCustomerShelfRoleAttestationSafe({ ...safe, [key]: true }), false, key);
  }

  const auditSource = readFileSync('scripts/audit-customer-shelf-rls.ts', 'utf8');
  const runtimeSource = readFileSync('lib/customer/shelf-database.ts', 'utf8');
  const attestationQuery = (source: string) => source.match(
    /select\s+current_user = \$\{CUSTOMER_SHELF_RUNTIME_ROLE\}[\s\S]*?where role\.rolname = current_user/,
  )?.[0]
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),])\s*/g, '$1');
  assert.ok(attestationQuery(auditSource));
  assert.equal(attestationQuery(auditSource), attestationQuery(runtimeSource));
  for (const source of [auditSource, runtimeSource]) {
    assert.match(source, /as requests_shelf_privileges_exact/);
    assert.match(source, /as images_shelf_privileges_exact/);
    assert.match(source, /as mutations_shelf_privileges_exact/);
    assert.match(source, /as cleanup_shelf_privileges_exact/);
    assert.match(source, /has_table_privilege\(app_role\.oid,[^\n]+, 'MAINTAIN'\)/g);
    assert.match(source, /as research_mentions_app_privileges_exact/);
    assert.match(source, /'request_id', 'SELECT'/);
    assert.match(source, /'EXECUTE WITH GRANT OPTION'/);
  }
});

test('named actions derive the customer and keep the workspace FAB contract unchanged', () => {
  const actions = readFileSync('app/(customer)/me/actions.ts', 'utf8');
  const button = readFileSync('components/me/shelf/shelf-action-button.tsx', 'utf8');
  const buttonStyles = readFileSync('components/me/shelf/shelf-action-button.module.css', 'utf8');
  const dock = readFileSync('components/me/shell/me-shell-model.ts', 'utf8');
  assert.match(actions, /export async function addProductToShelfAction/);
  assert.match(actions, /export async function removeShelfItemAction/);
  assert.match(actions, /const customer = await requireCustomer\(\)/g);
  assert.doesNotMatch(actions, /ownerId|ownerSubject|customerId/);
  assert.match(button, /Saving…/);
  assert.match(button, /Removing…/);
  assert.match(button, /Saved/);
  assert.match(button, /aria-live="polite"/);
  assert.match(buttonStyles, /min-height: 44px/);
  assert.doesNotMatch(dock, /Add to Shelf|Remove from Shelf/);
});

test('Shelf export is owner-derived, no-store, and contains no owner field', () => {
  const route = readFileSync('app/(customer)/me/shelf/export/route.ts', 'utf8');
  assert.match(route, /const customer = await requireCustomer\(\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /reviewedSnapshot: item\.snapshot/);
  assert.match(route, /lifecycleState: item\.lifecycleState/);
  assert.match(route, /savedAt: item\.savedAt/);
  assert.doesNotMatch(route, /ownerSubject|owner_subject|customer\.email/);
});

test('the reviewed legacy manifest reconciles all 14 hashed source records exactly once', () => {
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.source.commit, '04c45c87db839d516d0dc91cf93ac690445a9949');
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.source.products.sha256, '17d6d7173dc2a724eaad873afbc43b5b1b325ea87baa3e4faa922214c73b89f3');
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.source.routine.sha256, '3326dd88e087807ec11223755364ef04aebe2cb61ff65c5021e8211a3d01fe6f');
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.accepted.length, 5);
  assert.deepEqual(LEGACY_SHELF_IMPORT_MANIFEST.source.products.legacyIds, [
    'cosrx', 'somebymi', 'anua', 'wonder', 'bright', 'blab', 'dove',
    'deodorant', 'miracle', 'lush', 'mediana', 'kuza', 'ogx', 'disaar',
  ]);
  for (const binding of LEGACY_SHELF_IMPORT_MANIFEST.accepted) {
    const product = products.find(candidate => (
      candidate.slug === binding.identityVersion.slugAtReview
    ));
    assert.deepEqual(
      product && {
        slugAtReview: product.slug,
        brandAtReview: product.brand,
        variantAtReview: product.name,
      },
      {
        slugAtReview: binding.identityVersion.slugAtReview,
        brandAtReview: binding.identityVersion.brandAtReview,
        variantAtReview: binding.identityVersion.variantAtReview,
      },
    );
    assert.ok(binding.provenance.priority);
    assert.ok(binding.provenance.usage);
    assert.ok(binding.provenance.routineReferences.length > 0);
  }
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.length, 9);
  assert.deepEqual(
    LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.map(item => item.legacyId),
    ['bright', 'blab', 'dove', 'deodorant', 'miracle', 'lush', 'mediana', 'kuza', 'disaar'],
  );
  assert.deepEqual(LEGACY_SHELF_IMPORT_MANIFEST.requiredIdentity, {
    versionNumber: 1,
    provenance: 'jelocare_reviewed',
    publicEligibilityBasis: 'reviewed_catalogue_projection',
    packageVersion: 'reviewed-baseline-v1:static-v1',
    formulaVersion: 'reviewed-baseline-v1:static-v1',
    lifecycleState: 'active',
  });
  const classified = [
    ...LEGACY_SHELF_IMPORT_MANIFEST.accepted.map(item => item.legacyId),
    ...LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.map(item => item.legacyId),
  ];
  assert.equal(new Set(classified).size, 14);
  assert.deepEqual([...classified].sort(), [...LEGACY_SHELF_IMPORT_MANIFEST.source.products.legacyIds].sort());
  assert.doesNotThrow(() => verifyLegacyShelfImportSourceSnapshot());
});

test('the immutable legacy snapshot verifies without Git history and stays outside every client graph', () => {
  const verifierPath = join(repositoryRoot, 'lib/customer/legacy-shelf-import-source.ts');
  const snapshotPath = join(
    repositoryRoot,
    'lib/customer/legacy-shelf-import-source-snapshot.server.ts',
  );
  const verifierSource = readFileSync(verifierPath, 'utf8');
  const snapshotSource = readFileSync(snapshotPath, 'utf8');

  assert.doesNotThrow(() => verifyLegacyShelfImportSourceSnapshot());
  assert.match(snapshotSource, /from 'node:zlib'/);
  assert.match(verifierSource, /readLegacyShelfImportSourceSnapshot\(\)/);
  assert.doesNotMatch(`${verifierSource}\n${snapshotSource}`, /node:child_process|git fetch|git show/);

  const clientGraph = productionClientGraph();
  assert.equal(clientGraph.has(verifierPath), false);
  assert.equal(clientGraph.has(snapshotPath), false);
});

test('the one-off importer is dry-run by default, redacted, and apply-confirmed', () => {
  const ownerSubject = '11111111-1111-4111-8111-111111111111';
  const environment = { [LEGACY_SHELF_OWNER_SUBJECT_ENV]: ownerSubject };
  assert.deepEqual(parseLegacyShelfImportOptions([], environment), {
    apply: false,
    ownerSubject,
    targetReceiptSha256: null,
  });
  assert.throws(() => parseLegacyShelfImportOptions(['--apply'], environment), /receipt hash/);
  const confirmation = targetImportReceiptSha256(ownerSubject);
  assert.equal(parseLegacyShelfImportOptions([
    '--apply',
    `--confirm-receipt-sha256=${confirmation}`,
  ], environment).apply, true);
  assert.throws(() => parseLegacyShelfImportOptions(['--email=private@example.test'], environment), /Only --apply/);

  const script = readFileSync('scripts/import-customer-shelf.ts', 'utf8');
  assert.match(script, /requireAdminDatabaseUrl\(\)/);
  assert.doesNotMatch(script, /DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING|process\.env\.(?:DATABASE_URL|POSTGRES_URL)/);
  assert.match(script, /verifyLegacyShelfImportSourceSnapshot\(\)/);
  assert.match(script, /sql\.begin\('read only', work\)/);
  assert.match(script, /options\.apply[\s\S]*for update of auth_user/);
  assert.match(script, /options\.apply[\s\S]*for share of version, product/);
  assert.doesNotMatch(script, /for share of version, product, brand/);
  assert.match(script, /version\.slug_at_review = \$\{item\.identityVersion\.slugAtReview\}/);
  assert.match(script, /version\.brand_at_review = \$\{item\.identityVersion\.brandAtReview\}/);
  assert.match(script, /version\.variant_at_review = \$\{item\.identityVersion\.variantAtReview\}/);
  assert.match(script, /version\.size_at_review = \$\{item\.identityVersion\.sizeAtReview\}/);
  assert.match(script, /version\.provenance = \$\{manifest\.requiredIdentity\.provenance\}/);
  assert.match(script, /version\.public_eligibility_basis = \$\{manifest\.requiredIdentity\.publicEligibilityBasis\}/);
  assert.match(script, /version\.lifecycle_state = \$\{manifest\.requiredIdentity\.lifecycleState\}/);
  assert.match(script, /product\.is_published = true/);
  assert.doesNotMatch(script, /product\.(?:slug|name|size|source_version)\s*=/);
  assert.doesNotMatch(script, /brand\.name\s*=/);
  assert.match(script, /lock table public\.customer_shelf_items in share row exclusive mode/);
  assert.match(script, /returning product_identity_version_id/);
  assert.match(script, /hasExactSet\(acceptedToAdd, acceptedInserted\)/);
  assert.match(script, /hasExactSet\(acceptedIdentityIds, acceptedFinal\)/);
  assert.match(script, /hasExactSet\(pendingToAdd, pendingInserted\)/);
  assert.match(script, /hasExactSet\(pendingRequestIds, pendingFinal\)/);
  assert.match(script, /customer_shelf_import_receipts/);
  assert.match(script, /completion: 'already-completed'/);
  assert.match(script, /completion: options\.apply \? 'completed' : 'pending'/);
  assert.match(script, /accepted-inserted=\$\{report\.acceptedInserted\}/);
  assert.match(script, /pending-inserted=\$\{report\.pendingInserted\}/);
  assert.doesNotMatch(script, /delete from public\.customer_shelf_items/);
  assert.match(script, /if \(options\.apply\)/);
  assert.match(script, /pg_catalog\.to_jsonb\(auth_user\) \? 'emailVerified'/);
  assert.match(script, /pg_catalog\.to_jsonb\(auth_user\) \? 'banned'/);
  assert.match(script, /selectExactlyOneVerifiedTarget/);
  const shelfLock = script.indexOf('lock table public.customer_shelf_items in share row exclusive mode');
  const existingRead = script.indexOf('select product_identity_version_id\n    from public.customer_shelf_items');
  const finalSetCheck = script.indexOf('hasExactSet(acceptedIdentityIds, acceptedFinal)');
  const receiptWrite = script.indexOf('insert into public.customer_shelf_import_receipts');
  assert.ok(shelfLock >= 0 && shelfLock < existingRead);
  assert.ok(finalSetCheck >= 0 && finalSetCheck < receiptWrite);
  assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*ownerSubject/);
});

test('the real Shelf role and owner isolation audit is explicit and rolls writes back', () => {
  const script = readFileSync('scripts/audit-customer-shelf-rls.ts', 'utf8');
  const packageSource = readFileSync('package.json', 'utf8');
  assert.match(packageSource, /"customer:shelf:audit": "tsx scripts\/audit-customer-shelf-rls\.ts"/);
  assert.match(script, /process\.env\.CUSTOMER_SHELF_DATABASE_URL/);
  assert.doesNotMatch(script, /DATABASE_URL\s*\?\?|POSTGRES_URL/);
  assert.match(script, /current_user = \$\{CUSTOMER_SHELF_RUNTIME_ROLE\}/);
  assert.match(script, /session_user = \$\{CUSTOMER_SHELF_RUNTIME_ROLE\}/);
  assert.match(script, /--exercise-rollback/);
  assert.match(script, /insert into public\.customer_shelf_items/);
  assert.match(script, /on conflict \(owner_subject, product_identity_version_id\) do nothing/);
  assert.match(script, /duplicateAdd\.length !== 0/);
  assert.match(script, /forged owner insert/);
  assert.match(script, /update privilege/);
  assert.match(script, /truncate privilege/);
  assert.match(script, /private receipt access/);
  assert.match(script, /customer_shelf_import_receipts/);
  assert.match(script, /current_setting\('app\.customer_subject', true\)/);
  assert.match(script, /assertNoPooledSubjectOrVisibleShelfRows/);
  assert.match(script, /sql\.begin\('read only'/);
  assert.match(script, /transaction\.savepoint/);
  assert.match(script, /INSUFFICIENT_PRIVILEGE = '42501'/);
  assert.match(script, /visibleToB\[0\]\?\.count !== 0/);
  assert.match(script, /crossOwnerDelete\.length !== 0/);
  assert.match(script, /insert into public\.customer_product_requests/);
  assert.match(script, /insert into public\.customer_product_request_mutations/);
  assert.match(script, /on conflict \(owner_subject, idempotency_key\) do nothing/);
  assert.match(script, /staleUpdate\.length !== 0/);
  assert.match(script, /insert into public\.customer_product_request_images/);
  assert.match(script, /photo_identification_consent = false/);
  assert.match(script, /lifecycle_state = 'withdrawn'/);
  assert.match(script, /insert into public\.customer_product_request_blob_cleanup/);
  assert.match(script, /sync_customer_product_request_research_signal/);
  assert.match(script, /assertNoRolledBackOwnerRows/);
  assert.match(script, /throw new ExpectedAuditRollback\(\)/);
  assert.match(script, /error instanceof ExpectedAuditRollback/);
  assert.doesNotMatch(script, /for (?:no key )?(?:share|update)/i);
  assert.doesNotMatch(script, /@vercel\/blob/);
  assert.doesNotMatch(
    script,
    /console\.(?:log|error)\([^\n]*(?:ownerA|ownerB|identity_version_id|requestId|blobPathname|normalizedEntityRef)/,
  );
});

test('the request-signal bridge uses PostgreSQL GREATEST as a SQL expression', () => {
  const migration = readFileSync(
    'db/migrations/0046_fix_customer_request_signal_bridge.sql',
    'utf8',
  );
  assert.match(
    migration,
    /create or replace function public\.sync_customer_product_request_research_signal/,
  );
  assert.match(migration, /set signal_count = greatest\(signal_count - 1, 0\)/);
  assert.doesNotMatch(migration, /pg_catalog\.greatest/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = pg_catalog, public/);
  assert.match(
    migration,
    /revoke all privileges on function public\.sync_customer_product_request_research_signal\(uuid\)\s+from public, jelocare_app_runtime/,
  );
  assert.match(
    migration,
    /grant execute on function public\.sync_customer_product_request_research_signal\(uuid\)\s+to jelocare_shelf_runtime/,
  );
});
