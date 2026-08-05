'use client';

import Link from 'next/link';
import { Compass } from 'lucide-react';
import { ME_PORTAL_SURFACES } from '@/components/me/shell/me-shell-model';
import styles from '../home/me-home.module.css';

export function MemberNotFoundView() {
  const surface = ME_PORTAL_SURFACES['not-found'];
  return (
    <section className={`${styles.routePage} ${styles.stackPage} ${styles.notFoundPage}`} aria-labelledby="me-not-found-title">
      <div className={styles.routeHeading}>
        <p className={styles.eyebrow}>{surface.eyebrow}</p>
        <h1 id="me-not-found-title">{surface.title}</h1>
        <p>This product is not in your exact catalogue.</p>
        <div className={styles.notFoundActions}>
          <Link className={styles.primaryAction} href="/me/explore">
            Explore products <Compass size={18} aria-hidden="true" />
          </Link>
          <Link className={styles.sectionLink} href="/me/shelf">Back to Shelf</Link>
        </div>
      </div>
    </section>
  );
}
