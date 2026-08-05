'use client';

import Link from 'next/link';
import { ClockAlert, ClockPlus } from 'lucide-react';
import { RoutineManager } from '@/components/me/routine/routine-manager';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import { SafeProductImage } from '@/components/products/safe-product-image';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import styles from '../home/me-home.module.css';

function memberProductHref(product: { slug: string }, source?: string) {
  const pathname = `/me/product/${product.slug}`;
  return source ? `${pathname}?from=${source}` : pathname;
}

function RoutineRail({ viewModel }: { viewModel: CustomerPortalViewModel }) {
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

export function RoutineView({
  viewModel,
  mutationOutcome,
}: {
  viewModel: CustomerPortalViewModel;
  mutationOutcome?: string;
}) {
  const surface = ME_PORTAL_SURFACES.routine;
  return (
    <section className={styles.routePage} aria-labelledby="me-routine-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{viewModel.routineProvenance ?? surface.eyebrow}</p>
        <h1 id="me-routine-title">{surface.title}</h1>
      </div>
      {viewModel.routine.length ? (
        <section className={`${styles.fullSection} ${styles.routineSurface}`} aria-labelledby="me-routine-preview-title">
          <div className={styles.fullSectionHeading}>
            <div>
              <h2 id="me-routine-preview-title">My steps.</h2>
            </div>
          </div>
          <RoutineRail viewModel={viewModel} />
        </section>
      ) : null}
      {viewModel.routines ? (
        <RoutineManager
          routines={viewModel.routines}
          routineState={viewModel.routineState ?? { status: 'ready', message: null }}
          outcome={mutationOutcome}
        />
      ) : null}
    </section>
  );
}
