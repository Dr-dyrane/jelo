import { SafeProductImage } from '@/components/products/safe-product-image';
import type { HumanRef } from '@/lib/humanize/refs';
import { IdChip } from './IdChip';
import styles from './chips.module.css';

// A humanized subject: reviewed thumbnail + brand + name for a resolved product;
// an initial-block placeholder when the image is unreviewed or the product is
// unknown; an IdChip for a bare/anonymous reference. (`ref` is reserved by React,
// so the prop is `subject`.)
export function ProductRef({ subject }: { subject: HumanRef }) {
  if (subject.kind === 'anonymous') {
    return <IdChip value={subject.raw} label="anon" />;
  }

  const showImage = subject.kind === 'product' && subject.displayApproved && Boolean(subject.image);

  return (
    <span className={styles.productRef}>
      {showImage ? (
        <SafeProductImage src={subject.image!} alt={subject.name} className={styles.thumb} />
      ) : (
        <span className={styles.thumbPlaceholder} aria-hidden="true">{subject.name.slice(0, 1)}</span>
      )}
      <span className={styles.refText}>
        {subject.brand ? <span className={styles.brand}>{subject.brand}</span> : null}
        <span className={styles.name}>{subject.name}</span>
      </span>
    </span>
  );
}
