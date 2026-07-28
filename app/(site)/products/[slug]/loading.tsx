import styles from './product-loading.module.css';

function Line({ width }: { width: 'short' | 'medium' | 'long' }) {
  return <span className={styles.line} data-width={width} />;
}

export default function ProductLoading() {
  return (
    <main className={`product-page ${styles.page}`} aria-busy="true">
      <p className="sr-only" role="status">Loading product details.</p>

      <section className={`product-hero ${styles.hero}`} aria-hidden="true">
        <div className={`product-visual-large ${styles.visual}`}>
          <span className={styles.packshot} />
        </div>

        <div className={`product-story ${styles.story}`}>
          <Line width="short" />
          <div className={styles.title}>
            <Line width="long" />
            <Line width="medium" />
          </div>
          <div className={styles.meta}>
            <span />
            <span />
            <span />
          </div>
          <Line width="medium" />
          <div className={styles.price}>
            <Line width="short" />
          </div>
          <div className={styles.panel}>
            <Line width="medium" />
            <Line width="long" />
            <Line width="medium" />
          </div>
        </div>
      </section>
    </main>
  );
}
