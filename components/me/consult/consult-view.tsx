'use client';

import { useMemo, type RefObject } from 'react';
import {
  ConsultExperience,
  type MemberConsultContext,
} from '@/components/consult/consult-experience';
import type { CustomerPortalViewModel } from '@/lib/customer/portal-model';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import styles from '../home/me-home.module.css';

export function ConsultView({
  viewModel,
  composerRef,
}: {
  viewModel: CustomerPortalViewModel;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const surface = ME_PORTAL_SURFACES.consult;
  const memberContext = useMemo<MemberConsultContext>(() => {
    const products = new Map<string, { slug: string; brand: string; name: string }>();

    viewModel.shelf.forEach((item) => {
      if (item.product) {
        products.set(item.product.slug, {
          slug: item.product.slug,
          brand: item.product.brand,
          name: item.product.name,
        });
      }
    });
    viewModel.routine.forEach((step) => {
      products.set(step.product.slug, {
        slug: step.product.slug,
        brand: step.product.brand,
        name: step.product.name,
      });
    });
    viewModel.routines?.forEach((routine) => {
      routine.steps.forEach((step) => {
        if (step.product) {
          products.set(step.product.slug, {
            slug: step.product.slug,
            brand: step.product.brand,
            name: step.product.name,
          });
        }
      });
    });

    return {
      concerns: viewModel.concerns.map((concern) => ({
        slug: concern.slug,
        name: concern.name,
      })),
      products: [...products.values()],
    };
  }, [viewModel.concerns, viewModel.routine, viewModel.routines, viewModel.shelf]);

  return (
    <section className={`${styles.routePage} ${styles.stackPage}`} aria-labelledby="me-consult-title">
      <div className={`${styles.routeHeading} ${styles.consultRouteHeading}`}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-consult-title">Ask about my care.</h1>
        <p>Reviewed guidance with private context only when you choose it.</p>
      </div>
      <div className={styles.memberConsultExperience}>
        <ConsultExperience
          memberContext={memberContext}
          externalComposerRef={composerRef}
        />
      </div>
    </section>
  );
}
