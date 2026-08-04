'use client';

import Link from 'next/link';
import { CircleAlert, LoaderCircle, PackageSearch } from 'lucide-react';
import {
  ProductRequestDetailActions,
  ProductRequestDetailHero,
  ProductRequestLifecycleSection,
  ProductRequestOriginalSection,
  ProductRequestPhotoSection,
} from './product-request-detail-sections';
import {
  canEditProductRequestIdentity,
  canManageProductRequestPhoto,
  type ProductRequest,
} from './product-request-model';
import { useProductRequestDetail } from './use-product-request-detail';
import styles from './product-request-detail.module.css';
import sharedStyles from './product-request-primitives.module.css';

export function ProductRequestDetailPage({
  requestId,
  synthetic,
  initialRequest,
  mutationOutcome,
}: {
  requestId: string;
  synthetic: boolean;
  initialRequest?: ProductRequest | null;
  mutationOutcome?: string;
}) {
  const controller = useProductRequestDetail(requestId, synthetic, initialRequest);

  if (controller.status === 'loading') {
    return (
      <section className={styles.detailState} aria-busy="true" role="status">
        <LoaderCircle className={sharedStyles.spinner} size={25} aria-hidden="true" />
        <p>Opening your private request…</p>
      </section>
    );
  }

  if (controller.status === 'not-found') {
    return (
      <section className={styles.detailState}>
        <PackageSearch size={28} aria-hidden="true" />
        <h1>Request not found.</h1>
        <p>It may have been deleted, or it does not belong to this account.</p>
        <Link href="/me/shelf">Back to Shelf</Link>
      </section>
    );
  }

  if (controller.status === 'error' || !controller.request) {
    return (
      <section className={styles.detailState} role="alert">
        <CircleAlert size={28} aria-hidden="true" />
        <h1>Private request unavailable.</h1>
        <p>{controller.feedback}</p>
        <button type="button" onClick={() => void controller.load(true)}>Try again</button>
      </section>
    );
  }

  const canEditIdentity = canEditProductRequestIdentity(controller.request);
  const canManagePhoto = canManageProductRequestPhoto(controller.request);
  return (
    <article className={styles.detailPage} aria-labelledby="private-request-title">
      {mutationOutcome === 'created' || mutationOutcome === 'retry-confirmed' ? (
        <p className={styles.detailReceipt} role="status">
          {mutationOutcome === 'retry-confirmed'
            ? 'Request saved. Your retry returned the original result; nothing was duplicated.'
            : 'Private request saved.'}
        </p>
      ) : null}
      <ProductRequestDetailHero request={controller.request} />
      <ProductRequestOriginalSection controller={controller} canEdit={canEditIdentity} />
      <ProductRequestPhotoSection controller={controller} canManagePhoto={canManagePhoto} />
      <ProductRequestLifecycleSection request={controller.request} />
      <ProductRequestDetailActions controller={controller} />
    </article>
  );
}
