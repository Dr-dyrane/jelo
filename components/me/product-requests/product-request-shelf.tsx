'use client';

import Link from 'next/link';
import { ArrowRight, CircleAlert, LoaderCircle, PackageSearch } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SafeProductImage } from '@/components/products/safe-product-image';
import { listProductRequests, productRequestImageUrl } from './product-request-api';
import {
  ProductRequestLifecyclePill,
  ProductRequestOriginLabel,
} from './product-request-badges';
import {
  MUTED_PRODUCT_REQUEST_STATES,
  type ProductRequest,
} from './product-request-model';
import { productRequestErrorMessage } from './product-request-ui-utils';
import sharedStyles from './product-request-primitives.module.css';
import styles from './product-request-shelf.module.css';

const EMPTY_PRODUCT_REQUESTS: readonly ProductRequest[] = [];

function ProductRequestCard({ request }: { request: ProductRequest }) {
  const muted = MUTED_PRODUCT_REQUEST_STATES.has(request.lifecycleState);
  return (
    <article
      className={`${styles.requestCard} ${muted ? styles.requestCardMuted : ''}`}
      data-product-request-state={request.lifecycleState}
    >
      <Link href={`/me/shelf/request/${encodeURIComponent(request.id)}`}>
        <span className={styles.requestVisual} aria-hidden={!request.photo.present}>
          {request.photo.present ? (
            <SafeProductImage
              src={productRequestImageUrl(request)}
              alt={`${request.brand} ${request.fullPackName} private pack photo`}
            />
          ) : (
            <PackageSearch size={32} strokeWidth={1.35} aria-hidden="true" />
          )}
        </span>
        <span className={styles.requestCardCopy}>
          <span className={sharedStyles.requestCardMeta}>
            <ProductRequestLifecyclePill request={request} />
            <ProductRequestOriginLabel request={request} />
          </span>
          <small>{request.brand}</small>
          <strong>{request.fullPackName}</strong>
          <span>{request.printedSizeVariant}</span>
          {request.lifecycleState === 'matched' || request.lifecycleState === 'published' ? (
            <em>Catalogue match recorded · Original request retained</em>
          ) : null}
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </article>
  );
}

function RequestShelfHeading({ count }: { count: number | null }) {
  return (
    <header className={styles.requestShelfHeading}>
      <div>
        <p>Private requests</p>
        <h2 id="private-product-requests-title">Still identifying.</h2>
        <span>
          These are your original descriptions, not public catalogue products.
          {count === null ? '' : ` ${count} request${count === 1 ? '' : 's'}.`}
        </span>
      </div>
      <Link href="/me/shelf/add">Request a product <ArrowRight size={16} aria-hidden="true" /></Link>
    </header>
  );
}

export function PrivateProductRequestShelf({
  synthetic,
  initialRequests = EMPTY_PRODUCT_REQUESTS,
  mutationOutcome,
}: {
  synthetic: boolean;
  initialRequests?: readonly ProductRequest[];
  mutationOutcome?: string;
}) {
  const [state, setState] = useState<{
    status: 'loading' | 'ready' | 'error';
    requests: readonly ProductRequest[];
    message: string;
  }>(() => synthetic
    ? { status: 'ready', requests: initialRequests, message: '' }
    : { status: 'loading', requests: [], message: '' });
  const [retrySequence, setRetrySequence] = useState(0);

  useEffect(() => {
    if (synthetic) return;
    let current = true;
    listProductRequests()
      .then((requests) => {
        if (!current) return;
        setState({
          status: 'ready',
          requests: [...requests].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
          message: '',
        });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setState({ status: 'error', requests: [], message: productRequestErrorMessage(error) });
      });
    return () => { current = false; };
  }, [retrySequence, synthetic]);

  if (state.status === 'loading') {
    return (
      <section className={styles.requestShelf} aria-labelledby="private-product-requests-title" aria-busy="true">
        <RequestShelfHeading count={null} />
        <div className={styles.requestState} role="status">
          <LoaderCircle className={sharedStyles.spinner} size={22} aria-hidden="true" />
          <p>Opening your private requests…</p>
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className={styles.requestShelf} aria-labelledby="private-product-requests-title">
        <RequestShelfHeading count={null} />
        <div className={styles.requestState} role="alert">
          <CircleAlert size={22} aria-hidden="true" />
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: 'loading', requests: [], message: '' });
              setRetrySequence((value) => value + 1);
            }}
          >Try again</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.requestShelf} aria-labelledby="private-product-requests-title">
      <RequestShelfHeading count={state.requests.length} />
      {mutationOutcome === 'deleted' || mutationOutcome === 'delete-retry-confirmed' ? (
        <p className={styles.requestReceipt} role="status">
          {mutationOutcome === 'delete-retry-confirmed'
            ? 'Delete confirmed. Your retry returned the original result; nothing was duplicated.'
            : 'Private request deleted.'}
        </p>
      ) : null}
      {synthetic && state.requests.length ? (
        <p className={styles.previewHint}>Development preview · private request examples.</p>
      ) : null}
      {state.requests.length ? (
        <div className={styles.requestGrid}>
          {state.requests.map((request) => <ProductRequestCard key={request.id} request={request} />)}
        </div>
      ) : (
        <div className={styles.requestState}>
          <PackageSearch size={24} aria-hidden="true" />
          <p>No private product requests yet.</p>
          <Link href="/me/shelf/add">Request a product</Link>
        </div>
      )}
    </section>
  );
}
