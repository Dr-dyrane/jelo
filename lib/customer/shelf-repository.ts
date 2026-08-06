import 'server-only';

import {
  assertCustomerShelfRlsRole,
  getCustomerShelfPostgresClient,
} from './shelf-database';
import { isValidCustomerShelfOwnerSubject } from './shelf-policy';

export type CustomerShelfLifecycleState = 'active' | 'merged' | 'retired' | 'superseded';
export type CustomerShelfSaveOrigin = 'customer' | 'legacy_pages_v1_0';

export type CustomerShelfRecord = {
  identityVersionId: string;
  savedAt: string;
  saveOrigin: CustomerShelfSaveOrigin;
  lifecycleState: CustomerShelfLifecycleState;
  snapshot: {
    slug: string;
    brand: string;
    name: string;
    size: string;
    versionNumber: number;
    packageVersion: string;
    formulaVersion: string;
  };
  currentSlug: string | null;
  currentProductPublished: boolean;
};

export type CustomerShelfRepository = {
  list(ownerSubject: string): Promise<CustomerShelfRecord[]>;
  count(ownerSubject: string): Promise<number>;
  contextForProduct(ownerSubject: string, slug: string): Promise<CustomerShelfRecord[]>;
  addCurrentBySlug(ownerSubject: string, slug: string): Promise<'added' | 'already_saved' | 'unavailable'>;
  remove(ownerSubject: string, identityVersionId: string): Promise<'removed' | 'already_removed'>;
  clear(ownerSubject: string): Promise<number>;
};

type CustomerShelfRow = {
  product_identity_version_id: string;
  saved_at: Date | string;
  save_origin: CustomerShelfSaveOrigin;
  lifecycle_state: CustomerShelfLifecycleState;
  slug_at_review: string;
  brand_at_review: string;
  variant_at_review: string;
  size_at_review: string;
  version_number: number;
  package_version_at_review: string;
  formula_version_at_review: string;
  current_slug: string | null;
  current_product_published: boolean | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredOwnerSubject(ownerSubject: string) {
  const value = ownerSubject.trim();
  if (!isValidCustomerShelfOwnerSubject(value)) throw new Error('Customer Shelf owner is unavailable.');
  return value;
}

function requiredSlug(slug: string) {
  const value = slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 180) {
    throw new Error('Product is unavailable.');
  }
  return value;
}

function requiredIdentityVersionId(identityVersionId: string) {
  const value = identityVersionId.trim();
  if (!UUID.test(value)) throw new Error('Saved product is unavailable.');
  return value;
}

function mapShelfRow(row: CustomerShelfRow): CustomerShelfRecord {
  return {
    identityVersionId: row.product_identity_version_id,
    savedAt: new Date(row.saved_at).toISOString(),
    saveOrigin: row.save_origin,
    lifecycleState: row.lifecycle_state,
    snapshot: {
      slug: row.slug_at_review,
      brand: row.brand_at_review,
      name: row.variant_at_review,
      size: row.size_at_review,
      versionNumber: row.version_number,
      packageVersion: row.package_version_at_review,
      formulaVersion: row.formula_version_at_review,
    },
    currentSlug: row.current_slug,
    currentProductPublished: row.current_product_published === true,
  };
}

export const postgresCustomerShelfRepository: CustomerShelfRepository = {
  async list(ownerSubject) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const rows = await transaction<CustomerShelfRow[]>`
        select
          item.product_identity_version_id,
          item.saved_at,
          item.save_origin,
          version.lifecycle_state,
          version.slug_at_review,
          version.brand_at_review,
          version.variant_at_review,
          version.size_at_review,
          version.version_number,
          version.package_version_at_review,
          version.formula_version_at_review,
          product.slug as current_slug,
          product.is_published as current_product_published
        from public.customer_shelf_items item
        join public.catalogue_product_identity_versions version
          on version.identity_version_id = item.product_identity_version_id
        left join public.products product on product.id = version.product_id
        where item.owner_subject = ${owner}
        order by item.saved_at desc, item.product_identity_version_id
      `;
      return rows.map(mapShelfRow);
    });
  },

  async count(ownerSubject) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const rows = await transaction<{ count: number }[]>`
        select count(*)::int as count
        from public.customer_shelf_items
        where owner_subject = ${owner}
      `;
      return rows[0]?.count ?? 0;
    });
  },

  async contextForProduct(ownerSubject, slug) {
    const owner = requiredOwnerSubject(ownerSubject);
    const productSlug = requiredSlug(slug);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const rows = await transaction<CustomerShelfRow[]>`
        select
          item.product_identity_version_id,
          item.saved_at,
          item.save_origin,
          version.lifecycle_state,
          version.slug_at_review,
          version.brand_at_review,
          version.variant_at_review,
          version.size_at_review,
          version.version_number,
          version.package_version_at_review,
          version.formula_version_at_review,
          product.slug as current_slug,
          product.is_published as current_product_published
        from public.customer_shelf_items item
        join public.catalogue_product_identity_versions version
          on version.identity_version_id = item.product_identity_version_id
        left join public.products product on product.id = version.product_id
        where item.owner_subject = ${owner}
          and (version.slug_at_review = ${productSlug} or product.slug = ${productSlug})
        order by item.saved_at desc, item.product_identity_version_id
      `;
      return rows.map(mapShelfRow);
    });
  },

  async addCurrentBySlug(ownerSubject, slug) {
    const owner = requiredOwnerSubject(ownerSubject);
    const productSlug = requiredSlug(slug);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const [result] = await transaction<{ candidate_available: boolean; inserted: boolean }[]>`
        with candidate as materialized (
          select version.identity_version_id
          from public.catalogue_product_identity_versions version
          join public.products product on product.id = version.product_id
          where product.slug = ${productSlug}
            and product.is_published = true
            and version.lifecycle_state = 'active'
          order by version.version_number desc
          limit 1
        ), inserted as (
          insert into public.customer_shelf_items (
            owner_subject,
            product_identity_version_id,
            save_origin
          )
          select
            ${owner},
            candidate.identity_version_id,
            'customer'
          from candidate
          where true
          on conflict (owner_subject, product_identity_version_id) do nothing
          returning product_identity_version_id
        )
        select
          exists(select 1 from candidate) as candidate_available,
          exists(select 1 from inserted) as inserted
      `;
      if (!result?.candidate_available) return 'unavailable';
      return result.inserted ? 'added' : 'already_saved';
    });
  },

  async remove(ownerSubject, identityVersionId) {
    const owner = requiredOwnerSubject(ownerSubject);
    const versionId = requiredIdentityVersionId(identityVersionId);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const removed = await transaction<{ product_identity_version_id: string }[]>`
        delete from public.customer_shelf_items
        where owner_subject = ${owner}
          and product_identity_version_id = ${versionId}
        returning product_identity_version_id
      `;
      return removed.length === 1 ? 'removed' : 'already_removed';
    });
  },

  async clear(ownerSubject) {
    const owner = requiredOwnerSubject(ownerSubject);
    const sql = getCustomerShelfPostgresClient();
    return sql.begin(async transaction => {
      await transaction`select pg_catalog.set_config('search_path', 'pg_catalog, public', true)`;
      await assertCustomerShelfRlsRole(transaction);
      await transaction`select pg_catalog.set_config('app.customer_subject', ${owner}, true)`;
      const removed = await transaction<{ product_identity_version_id: string }[]>`
        delete from public.customer_shelf_items
        where owner_subject = ${owner}
        returning product_identity_version_id
      `;
      return removed.length;
    });
  },
};
