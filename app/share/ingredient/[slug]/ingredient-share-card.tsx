import Link from 'next/link';
import type { IngredientSeed } from '@/data/product-ingredients';
import styles from './ingredient-share.module.css';

const evidenceLabel: Record<IngredientSeed['evidenceGrade'], string> = {
  high: 'High evidence',
  moderate: 'Moderate evidence',
  emerging: 'Early evidence',
  insufficient: 'Limited evidence',
};

const sensitiveLabel: Record<IngredientSeed['sensitiveSkinStatus'], string | null> = {
  generally_safe: 'Generally gentle',
  use_with_caution: 'Use with care',
  avoid: 'Often avoided',
  unknown: null,
};

export function IngredientShareCard({ seed }: { seed: IngredientSeed }) {
  const sensitive = sensitiveLabel[seed.sensitiveSkinStatus];
  return (
    <div className={styles.card}>
      <span className={styles.tag}>{evidenceLabel[seed.evidenceGrade]}</span>
      <Link href={`/ingredients?ingredient=${seed.slug}`} className={styles.name}>{seed.commonName}</Link>
      <div className={styles.inci}>{seed.inciName}</div>
      <p className={styles.summary}>{seed.summary}</p>
      <div className={styles.meta}>
        {sensitive ? <span className={styles.chip}>{sensitive}</span> : null}
        <span className={styles.chip}>Source-checked</span>
      </div>
      <p className={styles.fine}>Education, not a diagnosis. Patch test and introduce one active at a time.</p>
    </div>
  );
}
