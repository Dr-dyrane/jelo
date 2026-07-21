import { ProductImageAudit } from '@/components/products/product-image-audit';
import { expandedProducts } from '@/data/expanded-products';
import { products as coreProducts } from '@/data/products';

export const metadata = { title: 'Image audit' };

export default function ImageAuditPage() {
  const products = [...coreProducts, ...expandedProducts];

  return (
    <main className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">Catalogue operations</p>
        <h1>Image<br/>audit.</h1>
        <p>This page loads every catalogue image in the browser and exposes remote failures and explicit placeholders.</p>
      </header>
      <ProductImageAudit products={products} />
    </main>
  );
}
