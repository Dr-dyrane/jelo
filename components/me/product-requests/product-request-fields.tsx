'use client';

import Link from 'next/link';
import { ArrowRight, Camera, Search } from 'lucide-react';
import { useMemo, type ChangeEvent, type RefObject } from 'react';
import { ShelfActionButton } from '@/components/me/shelf/shelf-action-button';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import { SafeProductImage } from '@/components/products/safe-product-image';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import {
  findExactCanonicalIdentity,
  PRODUCT_REQUEST_FIELD_LIMITS,
  searchCanonicalIdentities,
  type ProductRequestFields,
} from './product-request-model';
import { ACCEPTED_PRODUCT_REQUEST_IMAGE_TYPES } from './product-request-ui-utils';
import addStyles from './product-request-add.module.css';
import styles from './product-request-primitives.module.css';

const EMPTY_CATALOGUE: NonNullable<CustomerPortalViewModel['catalogue']> = [];

export function CanonicalProductRequestSearch({
  viewModel,
  search,
  onSearchChange,
  searchRef,
  shelfAction,
}: {
  viewModel: CustomerPortalViewModel;
  search: string;
  onSearchChange: (value: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  shelfAction?: ShelfActionHandler;
}) {
  const catalogue = viewModel.catalogue ?? EMPTY_CATALOGUE;
  const exact = useMemo(() => findExactCanonicalIdentity(catalogue, search), [catalogue, search]);
  const matches = useMemo(() => searchCanonicalIdentities(catalogue, search), [catalogue, search]);
  return (
    <section className={addStyles.canonicalSearch} aria-labelledby="canonical-search-title">
      <div className={styles.stepHeading}>
        <span>01</span>
        <div>
          <h2 id="canonical-search-title">Check the exact catalogue first.</h2>
          <p>Search the brand, full pack name, and printed size. A request starts only when the exact identity is not here.</p>
        </div>
      </div>
      <label className={addStyles.searchField}>
        <Search size={19} aria-hidden="true" />
        <span className={styles.visuallyHidden}>Search exact catalogue products</span>
        <input
          ref={searchRef}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Brand + full pack name + printed size"
          autoComplete="off"
        />
      </label>

      {search.trim() ? (
        matches.length ? (
          <div className={addStyles.canonicalMatches}>
            {matches.map((product) => {
              const saved = viewModel.shelf.some((item) => item.product?.slug === product.slug);
              const isExact = exact?.slug === product.slug;
              return (
                <article key={product.slug} className={isExact ? addStyles.exactCanonical : ''}>
                  <Link href={`/me/product/${product.slug}?from=shelf`}>
                    <SafeProductImage src={product.image} alt={`${product.brand} ${product.name}`} />
                    <span>
                      <small>{isExact ? 'Exact catalogue identity' : product.brand}</small>
                      <strong>{product.name}</strong>
                      <em>{product.brand} · {product.size}</em>
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                  {isExact ? (
                    <ShelfActionButton
                      productSlug={product.slug}
                      saved={saved}
                      placement="explore"
                      onAction={shelfAction}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className={addStyles.noCanonicalMatch} role="status">No catalogue identities contain all those terms.</p>
        )
      ) : null}
    </section>
  );
}

export function ProductRequestFieldsEditor({
  fields,
  onChange,
  disabled = false,
  idPrefix,
}: {
  fields: ProductRequestFields;
  onChange: (fields: ProductRequestFields) => void;
  disabled?: boolean;
  idPrefix: string;
}) {
  const update = <Key extends keyof ProductRequestFields>(key: Key, value: ProductRequestFields[Key]) => {
    onChange({ ...fields, [key]: value });
  };
  const hasBrand = Boolean(fields.brand.trim());
  const hasPackName = Boolean(fields.fullPackName.trim());
  const hasVariant = Boolean(fields.printedSizeVariant.trim());

  return (
    <div className={styles.fieldStack}>
      <label htmlFor={`${idPrefix}-brand`}>
        <span>Brand on the pack <b>Required</b></span>
        <input
          id={`${idPrefix}-brand`}
          value={fields.brand}
          maxLength={PRODUCT_REQUEST_FIELD_LIMITS.brand}
          disabled={disabled}
          required
          autoComplete="organization"
          onChange={(event) => update('brand', event.target.value)}
        />
      </label>
      {hasBrand ? (
        <label htmlFor={`${idPrefix}-pack-name`}>
          <span>Full pack name <b>Required</b></span>
          <input
            id={`${idPrefix}-pack-name`}
            value={fields.fullPackName}
            maxLength={PRODUCT_REQUEST_FIELD_LIMITS.fullPackName}
            disabled={disabled}
            required
            onChange={(event) => update('fullPackName', event.target.value)}
          />
        </label>
      ) : null}
      {hasBrand && hasPackName ? (
        <label htmlFor={`${idPrefix}-variant`}>
          <span>Printed size or variant <b>Required</b></span>
          <input
            id={`${idPrefix}-variant`}
            value={fields.printedSizeVariant}
            maxLength={PRODUCT_REQUEST_FIELD_LIMITS.printedSizeVariant}
            disabled={disabled}
            required
            placeholder="For example, 250 ml or Fragrance Free"
            onChange={(event) => update('printedSizeVariant', event.target.value)}
          />
        </label>
      ) : null}
      {hasBrand && hasPackName && hasVariant ? (
        <div className={styles.optionalFields}>
          <label htmlFor={`${idPrefix}-category`}>
            <span>Category <b>Optional</b></span>
            <input
              id={`${idPrefix}-category`}
              value={fields.category ?? ''}
              maxLength={PRODUCT_REQUEST_FIELD_LIMITS.category}
              disabled={disabled}
              placeholder="Face, hair, body…"
              onChange={(event) => update('category', event.target.value || null)}
            />
          </label>
          <label htmlFor={`${idPrefix}-retailer`}>
            <span>Where you saw it <b>Optional</b></span>
            <input
              id={`${idPrefix}-retailer`}
              value={fields.retailerLabel ?? ''}
              maxLength={PRODUCT_REQUEST_FIELD_LIMITS.retailerLabel}
              disabled={disabled}
              placeholder="Retailer or shop label"
              onChange={(event) => update('retailerLabel', event.target.value || null)}
            />
          </label>
          <label htmlFor={`${idPrefix}-source-url`}>
            <span>Product page <b>Optional</b></span>
            <input
              id={`${idPrefix}-source-url`}
              type="url"
              value={fields.sourceUrl ?? ''}
              maxLength={PRODUCT_REQUEST_FIELD_LIMITS.sourceUrl}
              disabled={disabled}
              inputMode="url"
              placeholder="https://…"
              onChange={(event) => update('sourceUrl', event.target.value || null)}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function ProductRequestPhotoConsent({
  checked,
  disabled = false,
  onChange,
  id,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}) {
  return (
    <label className={styles.consent} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>Allow authorized researchers to use this photo for identification.</strong>
        <small>
          Optional and off by default. Uploading a photo does not grant this permission.
          You can remove the photo or change permission later.
        </small>
      </span>
    </label>
  );
}

export function ProductRequestPhotoFileField({
  file,
  disabled = false,
  onChange,
  id,
  label = 'Add a private pack photo',
}: {
  file: File | null;
  disabled?: boolean;
  onChange: (file: File | null, error: string) => void;
  id: string;
  label?: string;
}) {
  function choose(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    if (!next) {
      onChange(null, '');
      return;
    }
    if (!ACCEPTED_PRODUCT_REQUEST_IMAGE_TYPES.has(next.type)) {
      event.target.value = '';
      onChange(null, 'Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (next.size > PRODUCT_REQUEST_FIELD_LIMITS.photoBytes) {
      event.target.value = '';
      onChange(null, 'Keep the private photo at 4 MB or smaller.');
      return;
    }
    onChange(next, '');
  }

  return (
    <label className={styles.photoField} htmlFor={id}>
      <Camera size={22} aria-hidden="true" />
      <span>
        <strong>{file?.name ?? label}</strong>
        <small>Optional · JPEG, PNG, or WebP · up to 4 MB</small>
      </span>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={choose}
      />
    </label>
  );
}
