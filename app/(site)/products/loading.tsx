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

export default function ProductsLoading() {
  return (
    <main className={styles.page} aria-busy="true">
      <p className="sr-only" role="status">Loading products.</p>

      <section className={styles.hero} aria-hidden="true">
        <div className={styles.heroCopy}>
          <Line width="short" />
          <div className={styles.heroTitle}>
            <Line width="long" />
            <Line width="medium" />
          </div>
        </div>
        <div className={styles.heroVisual} />
      </section>

      <div className={styles.search} aria-hidden="true">
        <span className={styles.searchIcon} />
        <Line width="medium" />
        <span className={styles.searchAction} />
      </div>

      <section className={styles.shelf} aria-hidden="true">
        <div className={styles.heading}>
          <Line width="short" />
          <Line width="medium" />
        </div>
        <div className={styles.rail}>
          {Array.from({ length: 4 }, (_, index) => (
            <span className={styles.railItem} key={index} />
          ))}
        </div>
      </section>

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
