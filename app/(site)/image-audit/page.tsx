import type { Metadata } from 'next';
import { ProductImageAudit } from '@/components/products/product-image-audit';
import { editorialAssets } from '@/data/editorial';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Image audit',
  description: 'Internal catalogue media review.',
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default async function ImageAuditPage() {
  const products = await listCatalogueProducts();

  return (
    <main className={styles.page}>
      <header className="page-heading">
        <p className="eyebrow">Catalogue operations</p>
        <h1>Image<br/>audit.</h1>
        <p>Live images. Packshots on peach, pink and dark.</p>
      </header>
      <ProductImageAudit products={products} editorialAssets={editorialAssets} />
    </main>
  );
}
