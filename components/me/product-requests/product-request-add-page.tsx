'use client';

import Link from 'next/link';
import { ArrowRight, LoaderCircle, PackageSearch, ShieldCheck } from 'lucide-react';
import type { RefObject } from 'react';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import {
  CanonicalProductRequestSearch,
  ProductRequestFieldsEditor,
  ProductRequestPhotoConsent,
  ProductRequestPhotoFileField,
} from './product-request-fields';
import { useProductRequestAdd } from './use-product-request-add';
import styles from './product-request-add.module.css';
import sharedStyles from './product-request-primitives.module.css';

export function ProductRequestAddPage({
  viewModel,
  shelfAction,
  searchRef,
}: {
  viewModel: CustomerPortalViewModel;
  shelfAction?: ShelfActionHandler;
  searchRef: RefObject<HTMLInputElement | null>;
}) {
  const controller = useProductRequestAdd(viewModel);
  return (
    <section className={styles.requestPage} aria-labelledby="product-request-add-title">
      <header className={styles.pageHeading}>
        <p>My Shelf · Private</p>
        <h1 id="product-request-add-title">Find it first.</h1>
        <span>A missing-product request stays private and never becomes a public or canonical product by itself.</span>
      </header>

      <CanonicalProductRequestSearch
        viewModel={viewModel}
        search={controller.search}
        onSearchChange={controller.changeSearch}
        searchRef={searchRef}
        shelfAction={shelfAction}
      />

      {controller.canOpenRequest && !controller.requestOpen ? (
        <div className={styles.requestGate}>
          <PackageSearch size={26} strokeWidth={1.4} aria-hidden="true" />
          <div>
            <strong>None of these is the exact pack?</strong>
            <p>Describe only what is printed or shown at the retailer. Researchers will review it privately.</p>
          </div>
          <button type="button" onClick={controller.openRequest}>Describe my exact pack</button>
        </div>
      ) : null}

      {controller.requestOpen && !controller.exact ? (
        <form className={styles.requestForm} onSubmit={(event) => { event.preventDefault(); controller.save(true); }}>
          <div className={sharedStyles.stepHeading}>
            <span>02</span>
            <div>
              <h2>Copy the pack identity.</h2>
              <p>These bounded fields preserve your wording as the original request.</p>
            </div>
          </div>
          <ProductRequestFieldsEditor
            fields={controller.fields}
            onChange={controller.setFields}
            disabled={controller.locked}
            idPrefix="new-request"
          />

          {controller.fields.brand.trim()
            && controller.fields.fullPackName.trim()
            && controller.fields.printedSizeVariant.trim() ? (
            <section className={styles.photoSection} aria-labelledby="new-request-photo-title">
              <div className={sharedStyles.stepHeading}>
                <span>03</span>
                <div>
                  <h2 id="new-request-photo-title">A photo can stay private too.</h2>
                  <p>The upload and identification permission are deliberately separate choices.</p>
                </div>
              </div>
              <ProductRequestPhotoFileField
                id="new-request-photo"
                file={controller.photo}
                disabled={controller.locked}
                onChange={controller.changePhoto}
              />
              <ProductRequestPhotoConsent
                id="new-request-photo-consent"
                checked={controller.fields.photoIdentificationConsent}
                disabled={controller.locked}
                onChange={(checked) => controller.setFields({
                  ...controller.fields,
                  photoIdentificationConsent: checked,
                })}
              />
              <p className={styles.privacyNote}>
                <ShieldCheck size={17} aria-hidden="true" />
                Your request, retailer evidence, and photo remain private customer data. Publication requires a separate reviewed catalogue record.
              </p>
            </section>
          ) : null}

          <div className={sharedStyles.formActions}>
            <button type="button" disabled={controller.pending || controller.synthetic} onClick={() => controller.save(false)}>Save draft</button>
            <button type="submit" disabled={controller.pending || controller.synthetic}>
              {controller.pending ? <LoaderCircle className={sharedStyles.spinner} size={17} aria-hidden="true" /> : null}
              Send for review
            </button>
          </div>
          <div className={styles.formFeedback} role="status" aria-live="polite">
            {controller.synthetic ? <p>Development preview · request creation is read-only.</p> : null}
            {controller.feedback ? <p>{controller.feedback}</p> : null}
            {controller.canonicalSlug ? (
              <Link href={`/me/product/${controller.canonicalSlug}?from=shelf`}>Open exact catalogue product <ArrowRight size={15} aria-hidden="true" /></Link>
            ) : null}
            {controller.createdRequest ? (
              <Link href={`/me/shelf/request/${encodeURIComponent(controller.createdRequest.id)}`}>Open saved private request <ArrowRight size={15} aria-hidden="true" /></Link>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
