import {
  PRODUCT_REQUEST_LIFECYCLE_LABELS,
  type ProductRequest,
} from './product-request-model';
import styles from './product-request-primitives.module.css';

export function ProductRequestOriginLabel({ request }: { request: ProductRequest }) {
  return (
    <span className={styles.originLabel}>
      {request.origin === 'legacy_pages_v1_0' ? 'Imported from legacy Shelf' : 'Requested by you'}
    </span>
  );
}

export function ProductRequestLifecyclePill({ request }: { request: ProductRequest }) {
  return (
    <span className={styles.lifecycle} data-lifecycle={request.lifecycleState}>
      {PRODUCT_REQUEST_LIFECYCLE_LABELS[request.lifecycleState]}
    </span>
  );
}
