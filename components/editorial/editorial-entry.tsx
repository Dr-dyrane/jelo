import type { ReactNode } from 'react';
import type { EditorialAsset } from '@/data/editorial';
import { SafeEditorialImage } from './safe-editorial-image';
import styles from './editorial-entry.module.css';

type EditorialEntryProps = {
  asset: EditorialAsset;
  children: ReactNode;
  layout?: 'band' | 'split';
  priority?: boolean;
};

export function EditorialEntry({ asset, children, layout = 'band', priority = false }: EditorialEntryProps) {
  return <section className={styles.entry} data-layout={layout}>
    <div className={styles.copy}>{children}</div>
    <div className={styles.visual}>
      <SafeEditorialImage
        asset={asset}
        alt={asset.altText}
        priority={priority}
        sizes={layout === 'split' ? '(max-width: 820px) 100vw, 40vw' : '(max-width: 820px) 100vw, 92vw'}
      />
    </div>
  </section>;
}
