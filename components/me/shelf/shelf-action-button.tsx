'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  addProductToShelfAction,
  removeShelfItemAction,
} from '@/app/(customer)/me/actions';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import type { CustomerPortalShelfItem } from '@/lib/customer/portal-model';
import styles from './shelf-action-button.module.css';

export function ShelfActionButton({
  productSlug,
  shelfItem,
  saved = false,
  placement,
  onSettled,
  onAction,
}: {
  productSlug?: string;
  shelfItem?: CustomerPortalShelfItem;
  saved?: boolean;
  placement: 'card' | 'explore' | 'product';
  onSettled?: (result: CustomerShelfActionResult) => void;
  onAction?: ShelfActionHandler;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState('');
  const removing = Boolean(shelfItem);
  const settledSaved = saved && !removing;
  const statusId = `shelf-action-${shelfItem?.identityVersionId ?? productSlug}`;

  function invoke() {
    if (pending || settledSaved) return;
    startTransition(async () => {
      const mutation = shelfItem
        ? { kind: 'remove' as const, identityVersionId: shelfItem.identityVersionId }
        : { kind: 'add' as const, productSlug: productSlug ?? '' };
      const result = onAction
        ? await onAction(mutation)
        : shelfItem
          ? await removeShelfItemAction(shelfItem.identityVersionId)
          : await addProductToShelfAction(productSlug ?? '');
      const conflict = result.status === 'conflict';
      setFeedback(conflict ? 'Product changed. Refreshed.' : result.message);
      onSettled?.(result);
      if (
        conflict
        || result.status === 'saved'
        || result.status === 'already_saved'
        || result.status === 'removed'
        || result.status === 'already_removed'
      ) {
        if (!onAction) router.refresh();
      }
    });
  }

  const label = pending
    ? removing ? 'Removing…' : 'Saving…'
    : settledSaved ? 'Saved'
      : removing ? 'Remove from Shelf' : 'Add to Shelf';

  return (
    <div className={`${styles.action} ${styles[placement]}`}>
      <button
        type="button"
        onClick={invoke}
        disabled={pending || settledSaved}
        aria-describedby={feedback ? statusId : undefined}
      >
        {label}
      </button>
      <span id={statusId} className={styles.status} role="status" aria-live="polite">
        {feedback}
      </span>
    </div>
  );
}
