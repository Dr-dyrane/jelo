import postgres, { type TransactionSql } from 'postgres';
import { LEGACY_SHELF_IMPORT_MANIFEST } from '@/lib/customer/legacy-shelf-import-manifest';
import {
  parseLegacyShelfImportOptions,
  selectExactlyOneVerifiedTarget,
} from '@/lib/customer/legacy-shelf-import-policy';
import { verifyLegacyShelfImportSourceFromGit } from '@/lib/customer/legacy-shelf-import-source';
import { requireAdminDatabaseUrl } from './lib/admin-database';

type ResolvedIdentity = {
  identity_version_id: string;
};

type LegacyShelfImportReport = {
  completion: 'already-completed';
  resolved: number;
  rejected: number;
} | {
  completion: 'pending' | 'completed';
  resolved: number;
  existingAccepted: number;
  plannedInsert: number;
  inserted: number;
  finalAccepted: number;
  rejected: number;
};

function hasExactIdentitySet(
  expected: readonly string[],
  actual: readonly string[],
) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return expectedSet.size === expected.length
    && actualSet.size === actual.length
    && expectedSet.size === actualSet.size
    && [...expectedSet].every(identityVersionId => actualSet.has(identityVersionId));
}

async function importWithinTransaction(
  transaction: TransactionSql,
  options: ReturnType<typeof parseLegacyShelfImportOptions>,
): Promise<LegacyShelfImportReport> {
  const manifest = LEGACY_SHELF_IMPORT_MANIFEST;
  await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;

  if (options.apply) {
    await transaction`lock table public.customer_shelf_import_receipts in share row exclusive mode`;
  }

  const candidates = options.apply
    ? await transaction<{ id: string }[]>`
        select auth_user.id
        from neon_auth."user" auth_user
        where pg_catalog.lower(pg_catalog.btrim(auth_user.email)) = ${options.normalizedMailbox}
          and pg_catalog.to_jsonb(auth_user) ? 'emailVerified'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'emailVerified')::boolean, false) = true
          and pg_catalog.to_jsonb(auth_user) ? 'banned'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'banned')::boolean, false) = false
        for update of auth_user
      `
    : await transaction<{ id: string }[]>`
        select auth_user.id
        from neon_auth."user" auth_user
        where pg_catalog.lower(pg_catalog.btrim(auth_user.email)) = ${options.normalizedMailbox}
          and pg_catalog.to_jsonb(auth_user) ? 'emailVerified'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'emailVerified')::boolean, false) = true
          and pg_catalog.to_jsonb(auth_user) ? 'banned'
          and coalesce((pg_catalog.to_jsonb(auth_user) ->> 'banned')::boolean, false) = false
      `;
  const ownerSubject = selectExactlyOneVerifiedTarget(candidates);
  await transaction`select pg_catalog.set_config('app.customer_subject', ${ownerSubject}, true)`;

  const [receipt] = await transaction<{ completed_at: Date }[]>`
    select completed_at
    from public.customer_shelf_import_receipts
    where manifest_id = ${manifest.id}
      and owner_subject = ${ownerSubject}
    limit 1
  `;
  if (receipt) {
    return {
      completion: 'already-completed',
      resolved: manifest.accepted.length,
      rejected: manifest.rejected.length,
    };
  }

  const resolved: string[] = [];
  for (const item of manifest.accepted) {
    const rowLock = options.apply
      ? transaction`for share of version, product`
      : transaction``;
    const identities = await transaction<ResolvedIdentity[]>`
      select version.identity_version_id
      from public.catalogue_product_identity_versions version
      join public.products product on product.id = version.product_id
      where version.slug_at_review = ${item.identityVersion.slugAtReview}
        and version.brand_at_review = ${item.identityVersion.brandAtReview}
        and version.variant_at_review = ${item.identityVersion.variantAtReview}
        and version.size_at_review = ${item.identityVersion.sizeAtReview}
        and version.version_number = ${manifest.requiredIdentity.versionNumber}
        and version.provenance = ${manifest.requiredIdentity.provenance}
        and version.public_eligibility_basis = ${manifest.requiredIdentity.publicEligibilityBasis}
        and version.package_version_at_review = ${manifest.requiredIdentity.packageVersion}
        and version.formula_version_at_review = ${manifest.requiredIdentity.formulaVersion}
        and version.lifecycle_state = ${manifest.requiredIdentity.lifecycleState}
        and product.is_published = true
      ${rowLock}
    `;
    if (identities.length !== 1 || !identities[0]) {
      throw new Error('A reviewed legacy binding did not resolve exactly once.');
    }
    resolved.push(identities[0].identity_version_id);
  }
  if (new Set(resolved).size !== manifest.accepted.length) {
    throw new Error('Reviewed legacy bindings did not resolve to distinct identities.');
  }

  if (options.apply) {
    await transaction`lock table public.customer_shelf_items in share row exclusive mode`;
  }

  const existing = await transaction<{ product_identity_version_id: string }[]>`
    select product_identity_version_id
    from public.customer_shelf_items
    where owner_subject = ${ownerSubject}
  `;
  const existingSet = new Set(existing.map(item => item.product_identity_version_id));
  const existingAccepted = resolved.filter(identityVersionId => existingSet.has(identityVersionId));
  const toAdd = resolved.filter(identityVersionId => !existingSet.has(identityVersionId));
  const inserted: string[] = [];
  let finalAccepted = existingAccepted;

  if (options.apply) {
    for (const identityVersionId of resolved) {
      const insertedRows = await transaction<{ product_identity_version_id: string }[]>`
        insert into public.customer_shelf_items (
          owner_subject,
          product_identity_version_id,
          save_origin
        ) values (
          ${ownerSubject},
          ${identityVersionId},
          'legacy_pages_v1_0'
        )
        on conflict (owner_subject, product_identity_version_id) do nothing
        returning product_identity_version_id
      `;
      if (insertedRows.length > 1) {
        throw new Error('A legacy Shelf insert returned an invalid result.');
      }
      if (insertedRows[0]) inserted.push(insertedRows[0].product_identity_version_id);
    }
    if (!hasExactIdentitySet(toAdd, inserted)) {
      throw new Error('Legacy Shelf inserts did not match the planned accepted identities.');
    }

    const finalShelf = await transaction<{ product_identity_version_id: string }[]>`
      select product_identity_version_id
      from public.customer_shelf_items
      where owner_subject = ${ownerSubject}
    `;
    const expectedSet = new Set(resolved);
    finalAccepted = finalShelf
      .map(item => item.product_identity_version_id)
      .filter(identityVersionId => expectedSet.has(identityVersionId));
    if (!hasExactIdentitySet(resolved, finalAccepted)) {
      throw new Error('The final Shelf does not contain the exact accepted identity set.');
    }

    await transaction`
      insert into public.customer_shelf_import_receipts (
        manifest_id,
        owner_subject,
        source_commit,
        source_products_sha256,
        accepted_count
      ) values (
        ${manifest.id},
        ${ownerSubject},
        ${manifest.source.commit},
        ${manifest.source.products.sha256},
        ${resolved.length}
      )
    `;
  }

  return {
    completion: options.apply ? 'completed' : 'pending',
    resolved: resolved.length,
    existingAccepted: existingAccepted.length,
    plannedInsert: toAdd.length,
    inserted: inserted.length,
    finalAccepted: finalAccepted.length,
    rejected: manifest.rejected.length,
  };
}

async function main() {
  const options = parseLegacyShelfImportOptions(process.argv.slice(2), process.env);
  verifyLegacyShelfImportSourceFromGit();
  const connectionString = requireAdminDatabaseUrl();

  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    const work = (transaction: TransactionSql) => importWithinTransaction(transaction, options);
    const report = options.apply
      ? await sql.begin(work)
      : await sql.begin('read only', work);

    const mode = options.apply ? 'APPLIED' : 'DRY RUN';
    const reconciliation = report.completion === 'already-completed'
      ? ''
      : report.completion === 'pending'
        ? `; existing-accepted=${report.existingAccepted}; would-insert=${report.plannedInsert}`
        : `; existing-accepted=${report.existingAccepted}; planned-insert=${report.plannedInsert}; inserted=${report.inserted}; final-accepted=${report.finalAccepted}`;
    console.log(`${mode}: target verified; completion=${report.completion}; resolved=${report.resolved}${reconciliation}; rejected=${report.rejected}.`);
  } finally {
    await sql.end();
  }
}

main().catch(() => {
  console.error('Customer Shelf import failed. No private target details were printed.');
  process.exitCode = 1;
});
