'use client';

import Link from 'next/link';
import { ClockAlert, ClockPlus, Search } from 'lucide-react';
import { ShelfActionButton } from '@/components/me/shelf/shelf-action-button';
import type { ShelfActionHandler } from '@/components/me/shelf/me-shelf-state';
import { SafeProductImage } from '@/components/products/safe-product-image';
import type { MeProductOrigin } from '@/components/me/shell/me-shell-model';
import type {
  CustomerPortalProduct,
  CustomerPortalShelfItem,
  CustomerPortalViewModel,
} from '@/lib/customer/portal-model';
import type { CustomerShelfActionResult } from '@/lib/customer/shelf-service';
import styles from './me-home.module.css';

type ProductSource = MeProductOrigin;

export function memberProductHref(product: CustomerPortalProduct, source?: ProductSource) {
  const pathname = `/me/product/${product.slug}`;
  return source ? `${pathname}?from=${source}` : pathname;
}

export function UnavailableShelfCard({
  item,
  shelfAction,
  onSettled,
}: {
  item: CustomerPortalShelfItem;
  shelfAction?: ShelfActionHandler;
  onSettled: (result: CustomerShelfActionResult) => void;
}) {
  return (
    <article className={`${styles.productCardShell} ${styles.unavailableProduct}`}>
      <div className={styles.unavailableCopy}>
        <small>{item.snapshot.brand}</small>
        <strong>{item.snapshot.name}</strong>
        <span>{item.snapshot.size} · {item.availability === 'changed' ? 'Changed' : 'Unavailable'}</span>
        {item.message ? <p>{item.message}</p> : null}
      </div>
      <ShelfActionButton
        shelfItem={item}
        placement="card"
        onAction={shelfAction}
        onSettled={onSettled}
      />
    </article>
  );
}

export function SearchField({
  value,
  onChange,
  inputRef,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
}) {
  return (
    <label className={styles.searchField}>
      <Search size={19} aria-hidden="true" />
      <span className={styles.visuallyHidden}>{label}</span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
      />
    </label>
  );
}

export function RoutineRail({ viewModel }: { viewModel: CustomerPortalViewModel }) {
  if (!viewModel.routine.length) {
    return (
      <div className={styles.emptyAction}>
        <ClockPlus size={24} strokeWidth={1.5} aria-hidden="true" />
        <p>No routine yet.</p>
        <Link href="/me/explore">Add routine step</Link>
      </div>
    );
  }
  return (
    <ol className={styles.routineGrid}>
      {viewModel.routine.map((step, index) => {
        const StatusIcon = step.status === 'alert' ? ClockAlert : ClockPlus;
        const statusLabel = step.status === 'alert'
          ? 'Routine alert'
          : step.status === 'done'
            ? 'Routine done'
            : 'Routine step confirmed';
        return (
          <li key={step.id}>
            <Link
              href={memberProductHref(step.product, 'routine')}
              className={styles.routineRailCard}
              aria-label={`View ${step.product.name}`}
            >
              <span className={styles.routineRailCardImage}>
                <SafeProductImage src={step.product.image} alt={`${step.product.brand} ${step.product.name}`} />
              </span>
              <span className={styles.routineRailCardNumber}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <StatusIcon size={16} aria-hidden="true" />
                <span className={styles.visuallyHidden}>{statusLabel}</span>
              </span>
              <span className={styles.routineRailCardCopy}>
                <small>{step.moment}</small>
                <strong>{step.product.brand} {step.product.name}</strong>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
