'use client';

import { useSearchParams } from 'next/navigation';
import styles from './products-loading.module.css';

function Line({ width }: { width: 'short' | 'medium' | 'long' }) {
  return <span className={styles.line} data-width={width} />;
}

function ProductSkeleton({ index }: { index: number }) {
  return (
    <article className={styles.product} aria-hidden="true" data-index={index}>
      <div className={styles.productVisual} />
      <div className={styles.productCopy}>
        <Line width="short" />
        <Line width="long" />
        <Line width="medium" />
      </div>
    </article>
  );
}

function hasCatalogueIntent(searchParams: ReturnType<typeof useSearchParams>) {
  const hasValue = (key: string) => Boolean(searchParams.get(key)?.trim());

  return (
    hasValue('q')
    || hasValue('category')
    || hasValue('brand')
    || hasValue('concern')
    || hasValue('step')
    || searchParams.get('market') === 'US'
    || (hasValue('review') && searchParams.get('review') !== 'all')
    || searchParams.get('availability') === 'priced'
    || (hasValue('price') && searchParams.get('price') !== 'all')
    || (hasValue('sort') && searchParams.get('sort') !== 'featured')
  );
}

export default function ProductsLoading() {
  const searchParams = useSearchParams();
  const hasActiveIntent = hasCatalogueIntent(searchParams);

  return (
    <main className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">Loading products.</p>

      <div className={styles.heroStage} aria-hidden="true">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Line width="short" />
            <div className={styles.heroTitle}>
              <Line width="long" />
              <Line width="medium" />
            </div>
          </div>
          <div className={styles.heroVisual} />
        </section>

        <div className={styles.searchShell}>
          <div className={styles.search}>
            <span className={styles.searchIcon} />
            <Line width="medium" />
            <span className={styles.searchAction} />
            <div className={styles.market}>
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>

      {!hasActiveIntent ? <section className={styles.shelf} aria-hidden="true">
        <div className={styles.heading}>
          <Line width="short" />
          <Line width="medium" />
        </div>
        <div className={styles.rail}>
          {Array.from({ length: 4 }, (_, index) => (
            <span className={styles.railItem} key={index} />
          ))}
        </div>
      </section> : null}

      <section className={styles.catalogue} aria-hidden="true">
        <div className={styles.catalogueHeading}>
          <div className={styles.heading}>
            <Line width="short" />
            <Line width="medium" />
          </div>
          <span className={styles.filter} />
        </div>
        <div className={styles.grid}>
          {Array.from({ length: 8 }, (_, index) => (
            <ProductSkeleton index={index} key={index} />
          ))}
        </div>
      </section>
    </main>
  );
}
