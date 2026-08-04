import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LEGACY_SHELF_IMPORT_MANIFEST } from '../../lib/customer/legacy-shelf-import-manifest';
import {
  normalizedCustomerProductEntityRef,
  normalizeCustomerProductRequestText,
} from '../../lib/customer/product-request-model';
import {
  createCustomerProductRequestSchema,
  customerProductRequestMutationSchema,
  isCustomerProductRequestPhotoConsentOnlyRevocation,
  updateCustomerProductRequestSchema,
} from '../../lib/customer/product-request-schema';
import {
  CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_CONFIRMATION,
  isPrivateCustomerProductRequestBlobPathname,
  parseCustomerProductRequestBlobCleanupOptions,
} from '../../lib/customer/product-request-cleanup-policy';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

const validCreate = {
  brand: '  B.LAB  ',
  fullPackName: 'Matcha Hydrating Real Sunscreen SPF50+ PA++++',
  printedSizeVariant: '50 ml',
  category: 'Face',
  retailerLabel: 'Beauty by Daz',
  sourceUrl: 'https://example.test/exact-pack',
  photoIdentificationConsent: false,
  submit: true,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
};

test('request fields are normalized, bounded, strict, and require explicit photo consent', () => {
  const parsed = createCustomerProductRequestSchema.parse(validCreate);
  assert.equal(parsed.brand, 'B.LAB');
  assert.equal(parsed.photoIdentificationConsent, false);
  assert.equal(normalizeCustomerProductRequestText('  Pack\u202e   Name  '), 'Pack Name');
  assert.throws(() => createCustomerProductRequestSchema.parse({
    ...validCreate,
    photoIdentificationConsent: undefined,
  }));
  assert.throws(() => createCustomerProductRequestSchema.parse({
    ...validCreate,
    ownerSubject: 'forged-owner',
  }));
  assert.throws(() => createCustomerProductRequestSchema.parse({
    ...validCreate,
    sourceUrl: 'http://example.test/product',
  }));
  assert.throws(() => createCustomerProductRequestSchema.parse({
    ...validCreate,
    brand: 'x'.repeat(121),
  }));
  assert.doesNotThrow(() => updateCustomerProductRequestSchema.parse({
    revision: 3,
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    photoIdentificationConsent: true,
  }));
  assert.throws(() => customerProductRequestMutationSchema.parse({
    revision: 3,
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    owner_subject: 'forged-owner',
  }));
  const revocation = updateCustomerProductRequestSchema.parse({
    revision: 3,
    idempotencyKey: '22222222-2222-4222-8222-222222222222',
    photoIdentificationConsent: false,
  });
  assert.equal(isCustomerProductRequestPhotoConsentOnlyRevocation(revocation), true);
  assert.equal(isCustomerProductRequestPhotoConsentOnlyRevocation({
    ...revocation,
    brand: 'Changed identity',
  }), false);
  assert.equal(isCustomerProductRequestPhotoConsentOnlyRevocation({
    ...revocation,
    photoIdentificationConsent: true,
  }), false);
});

test('custom entity references are deterministic, bounded, and contain product identity only', () => {
  const identity = {
    brand: 'B.LAB',
    fullPackName: 'Matcha Hydrating Real Sunscreen SPF50+ PA++++',
    printedSizeVariant: '50 ml',
  };
  const first = normalizedCustomerProductEntityRef(identity);
  assert.equal(first, normalizedCustomerProductEntityRef(identity));
  assert.match(first, /^custom:/);
  assert.ok(first.length <= 160);
  assert.doesNotMatch(first, /owner|email|retailer|example\.test/i);
  assert.notEqual(first, normalizedCustomerProductEntityRef({
    ...identity,
    printedSizeVariant: '100 ml',
  }));
});

test('legacy reconciliation is exactly five canonical identities and nine pending requests', () => {
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.accepted.length, 5);
  assert.equal(LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.length, 9);
  const fixture = source('lib/customer/legacy-product-request-fixture.ts');
  assert.match(fixture, /^import 'server-only'/);
  assert.match(fixture, /LEGACY_SHELF_IMPORT_MANIFEST\.pendingRequests\.map/);
  assert.match(fixture, /lifecycleState: 'pending'/);
  assert.match(fixture, /origin: 'legacy_pages_v1_0'/);
  assert.match(fixture, /identificationConsent: false/);
  const classified = [
    ...LEGACY_SHELF_IMPORT_MANIFEST.accepted.map(entry => entry.legacyId),
    ...LEGACY_SHELF_IMPORT_MANIFEST.pendingRequests.map(entry => entry.legacyId),
  ];
  assert.equal(new Set(classified).size, 14);
});

test('migration forces owner RLS and narrows the Shelf runtime grant', () => {
  const migration = source('db/migrations/0036_customer_product_requests.sql');
  for (const state of [
    'draft', 'pending', 'in_review', 'needs_info', 'matched', 'published', 'withdrawn',
  ]) {
    assert.match(migration, new RegExp(`'${state}'`));
  }
  for (const table of [
    'customer_product_requests',
    'customer_product_request_images',
    'customer_product_request_mutations',
    'customer_product_request_blob_cleanup',
  ]) {
    assert.match(migration, new RegExp(`alter table ${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table ${table} force row level security`));
  }
  assert.equal(
    migration.match(/current_setting\('app\.customer_subject', true\)/g)?.length,
    9,
  );
  assert.match(migration, /revoke all privileges on table public\.customer_product_requests from jelocare_app_runtime/);
  assert.match(migration, /grant select, insert, update on table public\.customer_product_requests to jelocare_shelf_runtime/);
  assert.doesNotMatch(migration, /grant delete on table public\.customer_product_requests/);
  assert.doesNotMatch(migration, /alter default privileges/i);
  assert.match(migration, /revoke all privileges on table public\.customer_product_request_research_mentions from jelocare_shelf_runtime/);
  assert.match(migration, /grant select \(task_id, active, first_seen_at, last_seen_at\)[\s\S]*to jelocare_app_runtime/);
  assert.doesNotMatch(migration, /grant select \([^)]*request_id[^)]*\)[\s\S]*customer_product_request_research_mentions/);
});

test('the pinned signal bridge adjusts one delta without exposing owner or photo to research tasks', () => {
  const migration = source('db/migrations/0036_customer_product_requests.sql');
  const bridge = migration.slice(
    migration.indexOf('create function sync_customer_product_request_research_signal'),
    migration.indexOf('alter table customer_shelf_import_receipts'),
  );
  assert.match(bridge, /security definer[\s\S]*set search_path = pg_catalog, public/);
  assert.match(migration, /revoke all privileges on function public\.sync_customer_product_request_research_signal\(uuid\) from public/);
  assert.match(migration, /revoke all privileges on function public\.sync_customer_product_request_research_signal\(uuid\) from jelocare_app_runtime/);
  assert.match(migration, /grant execute on function public\.sync_customer_product_request_research_signal\(uuid\) to jelocare_shelf_runtime/);
  assert.match(bridge, /signal_count = signal_count \+ 1/g);
  assert.match(bridge, /signal_count = pg_catalog\.greatest\(signal_count - 1, 0\)/);
  assert.match(bridge, /existing_mention\.task_id <> next_task_id/);
  assert.match(
    bridge,
    /if should_be_active and \([\s\S]*existing_mention\.request_id is null[\s\S]*not existing_mention\.active[\s\S]*existing_mention\.task_id <> next_task_id[\s\S]*set status = 'pending',[\s\S]*resolution_cycle = resolution_cycle \+ 1,[\s\S]*assigned_operator_id = null,[\s\S]*work_state = 'ready',[\s\S]*next_action = null,[\s\S]*last_reviewed_at = null[\s\S]*status in \('completed', 'dismissed'\)/,
  );
  assert.equal(
    bridge.match(/resolution_cycle = resolution_cycle \+ 1/g)?.length,
    1,
    'only a genuine terminal reopen may advance the research cycle',
  );
  assert.ok(
    bridge.indexOf('from public.customer_product_request_research_mentions mention')
      < bridge.indexOf('insert into public.community_research_tasks'),
    'the bridge must lock the existing mention before deciding whether demand is new',
  );
  assert.match(bridge, /request_row\.lifecycle_state = 'withdrawn'[\s\S]*delete from public\.customer_product_request_research_mentions/);
  const taskInsert = bridge.slice(
    bridge.indexOf('insert into public.community_research_tasks'),
    bridge.indexOf('on conflict (task_kind, entity_ref)'),
  );
  assert.match(taskInsert, /request_row\.normalized_entity_ref/);
  assert.match(taskInsert, /identity_label/);
  assert.doesNotMatch(taskInsert, /owner_subject|retailer_label|source_url|photo|consent|email/i);
});

test('aggregate reconciliation preserves request signals without exposing private request linkage', () => {
  const transitions = source('lib/moderation/database-transitions.ts');
  const management = source('scripts/manage-community-data.ts');
  const report = source('scripts/report-community-research-signals.ts');
  for (const consumer of [transitions, management]) {
    assert.match(consumer, /customer_product_request_research_mentions request_mention/);
    assert.match(consumer, /request_mention\.active/);
    assert.doesNotMatch(consumer, /request_mention\.(?:request_id|owner_subject|blob_pathname)/);
  }
  assert.match(report, /task\.signal_count/);
  assert.match(report, /task\.signal_count > 0/);
  assert.doesNotMatch(report, /customer_product_request_research_mentions/);
});

test('research resolution cycles preserve history while current projections bind the active cycle', () => {
  const migration = source('db/migrations/0036_customer_product_requests.sql');
  const writer = source('lib/community-intake/research-resolution.ts');
  const queues = source('lib/moderation/queues.ts');
  const audit = source('lib/moderation/audit-queries.ts');
  const activity = source('lib/moderation/activity-read-model.ts');
  assert.match(migration, /update community_research_tasks[\s\S]*set resolution_cycle = 1/);
  assert.match(migration, /update community_product_research_resolutions[\s\S]*set resolution_cycle = 1/);
  assert.match(migration, /primary key \(task_id, resolution_cycle\)/);
  assert.match(writer, /resolution_cycle = \$\{task\.resolution_cycle\}/);
  assert.match(writer, /on conflict \(task_id, resolution_cycle\) do nothing/);
  for (const currentProjection of [queues, audit, activity]) {
    assert.match(currentProjection, /resolution\.resolution_cycle = task\.resolution_cycle/);
  }
  assert.match(
    activity,
    /select outcome, count\(\*\)::int as outcome_count[\s\S]*from community_product_research_resolutions[\s\S]*group by outcome/,
  );
});

test('repository enforces exact catalogue rejection, optimistic revision, idempotency, and deletion scrubbing', () => {
  const repository = source('lib/customer/product-request-repository.ts');
  assert.match(repository, /assertCustomerShelfRlsRole\(transaction/);
  assert.match(repository, /set_config\('app\.customer_subject', \$\{ownerSubject\}, true\)/);
  assert.match(repository, /version\.lifecycle_state = 'active'[\s\S]*product\.is_published = true/);
  assert.match(repository, /version\.brand_at_review[\s\S]*version\.variant_at_review[\s\S]*version\.size_at_review/);
  assert.match(repository, /and revision = \$\{input\.expectedRevision\}/g);
  assert.match(repository, /customer_product_request_mutations/);
  assert.match(repository, /request_fingerprint_sha256/);
  assert.match(repository, /on conflict \(id\) do nothing/);
  assert.match(repository, /request\.lifecycle_state <> 'withdrawn'/g);
  assert.match(repository, /set lifecycle_state = 'withdrawn',[\s\S]*brand = null,[\s\S]*full_pack_name = null,[\s\S]*printed_size_variant = null/);
  assert.match(repository, /normalized_entity_ref = null/);
  assert.match(repository, /origin_reference = null/);
  assert.match(repository, /delete from public\.customer_product_request_images/);
  assert.match(repository, /customer_product_request_blob_cleanup/);
  assert.match(repository, /async revokePhotoIdentificationConsent/);
  assert.match(repository, /operation = 'consent_revoke'/);
  assert.match(repository, /set photo_identification_consent = false,[\s\S]*lifecycle_state <> 'withdrawn'[\s\S]*photo_identification_consent = true/);
  assert.doesNotMatch(
    repository.slice(
      repository.indexOf('async revokePhotoIdentificationConsent'),
      repository.indexOf('async withdraw'),
    ),
    /brand =|full_pack_name =|normalized_entity_ref =|exactActiveCatalogueMatch|sync_customer/,
  );
  const service = source('lib/customer/product-request-service.ts');
  assert.match(service, /isCustomerProductRequestPhotoConsentOnlyRevocation\(input\)[\s\S]*revokePhotoIdentificationConsent/);
});

test('private Blob cleanup is a bounded protected operator drain with durable retry', () => {
  assert.deepEqual(parseCustomerProductRequestBlobCleanupOptions([]), {
    apply: false,
    limit: 20,
  });
  assert.deepEqual(parseCustomerProductRequestBlobCleanupOptions([
    '--apply',
    '--limit', '100',
    '--confirm', CUSTOMER_PRODUCT_REQUEST_BLOB_CLEANUP_CONFIRMATION,
  ]), { apply: true, limit: 100 });
  assert.throws(() => parseCustomerProductRequestBlobCleanupOptions(['--apply']));
  assert.throws(() => parseCustomerProductRequestBlobCleanupOptions(['--limit', '101']));
  assert.equal(isPrivateCustomerProductRequestBlobPathname(
    'customer-product-requests/0123456789abcdef0123456789abcdef/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222-aabbccdd.webp',
  ), true);
  assert.equal(isPrivateCustomerProductRequestBlobPathname('https://example.test/private.webp'), false);

  const script = source('scripts/drain-customer-product-request-blob-cleanup.ts');
  const packageJson = source('package.json');
  assert.match(script, /requireAdminDatabaseUrl\(\)/);
  assert.match(script, /BLOB_READ_WRITE_TOKEN/);
  assert.match(script, /limit \$\{limit\}[\s\S]*for update skip locked/);
  assert.match(script, /await del\(row\.blob_pathname\)[\s\S]*delete from public\.customer_product_request_blob_cleanup/);
  assert.match(script, /durable row is intentionally retained/);
  assert.match(script, /No owner or pathname was printed/);
  assert.match(packageJson, /customer:product-request-blobs:drain/);
  assert.doesNotMatch(source('vercel.json'), /product-request|blob-cleanup/);
});

test('private image processing validates input, strips metadata, and stores only a private pathname', () => {
  const image = source('lib/customer/product-request-image.ts');
  const repository = source('lib/customer/product-request-repository.ts');
  const route = source('app/api/me/product-requests/[id]/image/route.ts');
  assert.match(image, /MAX_CUSTOMER_PRODUCT_REQUEST_IMAGE_BYTES = 4 \* 1024 \* 1024/);
  assert.match(image, /image\/jpeg/);
  assert.match(image, /image\/png/);
  assert.match(image, /image\/webp/);
  assert.match(image, /metadata\.format !== expectedFormat/);
  assert.match(image, /\.rotate\(\)[\s\S]*\.resize\([\s\S]*\.webp\(/);
  assert.doesNotMatch(image, /withMetadata/);
  assert.match(image, /access: 'private'/);
  assert.match(image, /stored\.pathname !== pathname/);
  assert.doesNotMatch(repository, /blob_url|download_url|stored\.url/);
  assert.match(repository, /request\.lifecycle_state <> 'withdrawn'/);
  assert.match(route, /authenticatedProductRequestCustomer\(\)/);
  assert.match(route, /private, no-store/);
  assert.match(route, /X-Content-Type-Options/);
});

test('API derives the owner from auth, rejects forged fields, and returns bounded conflict receipts', () => {
  const collection = source('app/api/me/product-requests/route.ts');
  const item = source('app/api/me/product-requests/[id]/route.ts');
  const api = source('lib/customer/product-request-api.ts');
  const schema = source('lib/customer/product-request-schema.ts');
  assert.match(collection, /authenticatedProductRequestCustomer\(\)/);
  assert.match(item, /authenticatedProductRequestCustomer\(\)/g);
  assert.match(collection, /allowedCustomerProductRequestMutation\(request\)/);
  assert.match(item, /allowedCustomerProductRequestMutation\(request\)/g);
  assert.match(schema, /\.strict\(\)/g);
  assert.doesNotMatch(schema, /ownerSubject|owner_subject|customerId|email/);
  assert.match(api, /code: 'ACTIVE_CATALOGUE_MATCH'/);
  assert.match(api, /code: 'REVISION_CONFLICT'/);
  assert.match(api, /case 'withdrawn':[\s\S]*deleted: true/);
  assert.doesNotMatch(api, /case 'withdrawn':[\s\S]{0,120}request: result\.request/);
  assert.match(api, /Cache-Control': 'private, no-store/);
});

test('protected importer is owner-subject and receipt addressed with a deterministic 5/9 outcome', () => {
  const policy = source('lib/customer/legacy-shelf-import-policy.ts');
  const importer = source('scripts/import-customer-shelf.ts');
  const runbook = source('docs/operations/RUNBOOKS.md');
  assert.match(policy, /JELOCARE_SHELF_IMPORT_OWNER_SUBJECT/);
  assert.match(policy, /confirm-receipt-sha256/);
  assert.doesNotMatch(policy, /mailbox|email/i);
  assert.match(importer, /where auth_user\.id = \$\{options\.ownerSubject\}/);
  assert.doesNotMatch(importer, /lower\(pg_catalog\.btrim\(auth_user\.email\)\)/);
  assert.match(importer, /acceptedResolved: manifest\.accepted\.length/);
  assert.match(importer, /pendingResolved: manifest\.pendingRequests\.length/);
  assert.match(importer, /pending_request_count/);
  assert.match(importer, /receipt\?\.pending_request_count === manifest\.pendingRequests\.length/);
  assert.match(importer, /const acceptedToAdd = receipt[\s\S]*\? \[\][\s\S]*: acceptedIdentityIds\.filter/);
  assert.match(importer, /for \(const identityVersionId of acceptedToAdd\)/);
  assert.match(importer, /if \(!receipt && !hasExactSet\(acceptedIdentityIds, acceptedFinal\)\)/);
  assert.match(importer, /sync_customer_product_request_research_signal/);
  const receiptLock = importer.indexOf(
    'lock table public.customer_shelf_import_receipts in share row exclusive mode',
  );
  const receiptRead = importer.indexOf('from public.customer_shelf_import_receipts');
  assert.ok(receiptLock >= 0 && receiptLock < receiptRead, 'apply must lock receipts before reading one');
  assert.doesNotMatch(importer, /delete from public\.customer_(?:shelf_items|product_requests)/);
  assert.match(runbook, /A fresh import[\s\S]*`accepted-final=5` and `pending-final=9`/);
  assert.match(runbook, /upgrade from the earlier[\s\S]*`accepted-final` is the current[\s\S]*`pending-final=9` remains mandatory/);
});

test('ADR pins the deidentified internal mention boundary rather than claiming owner RLS', () => {
  const adr = source('docs/adr/0014-customer-shelf-data-boundary.md');
  assert.match(adr, /research-mention[\s\S]*privileged internal, de-identified relation/);
  assert.match(adr, /no owner subject or private request fields/);
  assert.match(adr, /no direct table grant to PUBLIC or\s+`jelocare_shelf_runtime`/);
  assert.doesNotMatch(adr, /research-link tables\s+all have enabled and forced owner RLS/);
});
