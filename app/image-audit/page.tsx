import { ProductImageAudit } from '@/components/products/product-image-audit';
import { editorialAssets } from '@/data/editorial';
import { listCatalogueProducts } from '@/lib/catalogue/repository';
import styles from './page.module.css';

export const metadata = { title: 'Image audit' };

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
