'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  FilePenLine,
  ImageMinus,
  ImagePlus,
  LoaderCircle,
  PackageSearch,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { productRequestImageUrl } from './product-request-api';
import {
  ProductRequestLifecyclePill,
  ProductRequestOriginLabel,
} from './product-request-badges';
import {
  ProductRequestFieldsEditor,
  ProductRequestPhotoConsent,
  ProductRequestPhotoFileField,
} from './product-request-fields';
import { ProductRequestDeleteDialog } from './product-request-delete-dialog';
import {
  canRevokeProductRequestPhotoConsent,
  type ProductRequest,
} from './product-request-model';
import { formatProductRequestDate } from './product-request-ui-utils';
import type { useProductRequestDetail } from './use-product-request-detail';
import styles from './product-request-detail.module.css';
import sharedStyles from './product-request-primitives.module.css';

type DetailController = ReturnType<typeof useProductRequestDetail>;

export function ProductRequestDetailHero({ request }: { request: ProductRequest }) {
  return (
    <header className={styles.detailHero}>
      <div>
        <p>Private product request</p>
        <div className={sharedStyles.requestCardMeta}>
          <ProductRequestLifecyclePill request={request} />
          <ProductRequestOriginLabel request={request} />
        </div>
        <h1 id="private-request-title">{request.fullPackName}</h1>
        <span>{request.brand} · {request.printedSizeVariant}</span>
      </div>
      {request.photo.present ? (
        <div className={styles.detailPhoto}>
          <SafeProductImage
            key={`${request.id}:${request.revision}`}
            src={productRequestImageUrl(request)}
            alt={`${request.brand} ${request.fullPackName} private pack photo`}
            priority
          />
          <span><ShieldCheck size={15} aria-hidden="true" /> Private customer image</span>
        </div>
      ) : (
        <div className={styles.detailPhotoEmpty}><PackageSearch size={44} strokeWidth={1.15} aria-hidden="true" /></div>
      )}
    </header>
  );
}

export function ProductRequestOriginalSection({
  controller,
  canEdit,
}: {
  controller: DetailController;
  canEdit: boolean;
}) {
  const request = controller.request;
  if (!request) return null;
  return (
    <section className={styles.originalRequest} aria-labelledby="original-request-title">
      <header>
        <div>
          <p>Original request retained</p>
          <h2 id="original-request-title">Your pack description.</h2>
        </div>
        {canEdit && !controller.editing && !controller.synthetic ? (
          <button type="button" onClick={controller.beginEdit}><FilePenLine size={17} aria-hidden="true" /> Edit</button>
        ) : null}
      </header>

      {controller.editing ? (
        <form onSubmit={(event) => { event.preventDefault(); controller.saveChanges(); }}>
          <ProductRequestFieldsEditor
            fields={controller.fields}
            onChange={controller.setFields}
            disabled={controller.pending}
            idPrefix="edit-request"
          />
          <ProductRequestPhotoConsent
            id="edit-request-photo-consent"
            checked={controller.fields.photoIdentificationConsent}
            disabled={controller.pending}
            onChange={(checked) => controller.setFields({
              ...controller.fields,
              photoIdentificationConsent: checked,
            })}
          />
          <div className={sharedStyles.formActions}>
            <button type="button" disabled={controller.pending} onClick={controller.cancelEdit}>Cancel</button>
            <button type="submit" disabled={controller.pending}>Save changes</button>
          </div>
        </form>
      ) : (
        <dl className={styles.requestDescription}>
          <div><dt>Brand</dt><dd>{request.brand}</dd></div>
          <div><dt>Full pack name</dt><dd>{request.fullPackName}</dd></div>
          <div><dt>Printed size or variant</dt><dd>{request.printedSizeVariant}</dd></div>
          <div><dt>Category</dt><dd>{request.category ?? 'Not provided'}</dd></div>
          <div><dt>Retailer</dt><dd>{request.retailerLabel ?? 'Not provided'}</dd></div>
          <div>
            <dt>Source page</dt>
            <dd>{request.sourceUrl ? <a href={request.sourceUrl} target="_blank" rel="noreferrer">Open retailer evidence</a> : 'Not provided'}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

export function ProductRequestPhotoSection({
  controller,
  canManagePhoto,
}: {
  controller: DetailController;
  canManagePhoto: boolean;
}) {
  const request = controller.request;
  if (!request) return null;
  return (
    <section className={styles.photoManagement} aria-labelledby="private-photo-title">
      <div className={sharedStyles.stepHeading}>
        <span><Camera size={20} aria-hidden="true" /></span>
        <div>
          <h2 id="private-photo-title">Private photo.</h2>
          <p>
            Identification permission is <strong>{request.photo.identificationConsent ? 'on' : 'off'}</strong>.
            {request.photo.present
              ? canManagePhoto
                ? ' The original private image can be read, replaced, or removed here.'
                : ' The original image remains private and can be viewed here.'
              : ' No image is attached.'}
          </p>
        </div>
      </div>
      {canManagePhoto && !controller.synthetic ? (
        <div className={styles.photoActions}>
          <ProductRequestPhotoFileField
            id="replace-request-photo"
            file={controller.replacement}
            disabled={controller.pending}
            label={request.photo.present ? 'Choose a replacement photo' : 'Add a private pack photo'}
            onChange={controller.changeReplacement}
          />
          {controller.replacement ? (
            <button type="button" disabled={controller.pending} onClick={controller.replacePhoto}>
              <ImagePlus size={17} aria-hidden="true" />
              {request.photo.present ? 'Replace photo' : 'Add photo'}
            </button>
          ) : null}
          {request.photo.present ? (
            <button type="button" disabled={controller.pending} onClick={controller.removePhoto}>
              <ImageMinus size={17} aria-hidden="true" /> Remove photo
            </button>
          ) : null}
        </div>
      ) : null}
      {canRevokeProductRequestPhotoConsent(request)
        && !controller.synthetic
        && !controller.editing ? (
          <div className={styles.consentRevocation}>
            <p>
              Revoke identification permission without changing the request or removing its private photo.
            </p>
            <button
              type="button"
              disabled={controller.pending}
              onClick={controller.revokePhotoConsent}
            >
              Revoke photo identification permission
            </button>
          </div>
        ) : null}
    </section>
  );
}

function ProductRequestProvenance({ request }: { request: ProductRequest }) {
  return (
    <dl className={styles.provenance}>
      <div><dt>Origin</dt><dd><ProductRequestOriginLabel request={request} /></dd></div>
      <div><dt>Created</dt><dd>{formatProductRequestDate(request.createdAt)}</dd></div>
      <div><dt>Submitted</dt><dd>{formatProductRequestDate(request.submittedAt)}</dd></div>
      <div><dt>Last updated</dt><dd>{formatProductRequestDate(request.updatedAt)}</dd></div>
    </dl>
  );
}

export function ProductRequestLifecycleSection({ request }: { request: ProductRequest }) {
  return (
    <section className={styles.lifecycleSection} aria-labelledby="request-lifecycle-title">
      <div>
        <p>Lifecycle</p>
        <h2 id="request-lifecycle-title">Private until separately published.</h2>
        <span>
          A match never overwrites this record. The original request and provenance remain visible beside any catalogue identity version.
        </span>
      </div>
      <ProductRequestProvenance request={request} />
    </section>
  );
}

export function ProductRequestDetailActions({ controller }: { controller: DetailController }) {
  const request = controller.request;
  if (!request) return null;
  const canSubmit = request.lifecycleState === 'draft' || request.lifecycleState === 'needs_info';

  return (
    <>
      <div className={styles.detailActions}>
        {canSubmit ? (
          <button
            className={styles.submitAction}
            type="button"
            disabled={controller.pending || controller.synthetic}
            onClick={controller.submitRequest}
          >
            Send for review
          </button>
        ) : null}
        <ProductRequestDeleteDialog
          request={request}
          disabled={controller.pending || controller.synthetic}
          pending={controller.pending}
          onConfirm={controller.removeRequest}
        />
        <button type="button" disabled={controller.pending} onClick={() => void controller.load(true)}>
          <RotateCcw size={16} aria-hidden="true" /> Refresh revision
        </button>
      </div>

      <div className={styles.detailFeedback} role="status" aria-live="polite">
        {controller.pending ? <LoaderCircle className={sharedStyles.spinner} size={18} aria-hidden="true" /> : null}
        {controller.synthetic ? <p>Development preview · this manifest-backed request is read-only.</p> : null}
        {controller.feedback ? <p>{controller.feedback}</p> : null}
        {controller.canonicalSlug ? (
          <Link href={`/me/product/${controller.canonicalSlug}?from=shelf`}>
            Open exact catalogue product without replacing this request <ArrowRight size={15} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

    </>
  );
}
