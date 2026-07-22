import { ProductImageAudit } from '@/components/products/product-image-audit';
import { products } from '@/data/catalogue';
import { editorialAssets } from '@/data/editorial';

export const metadata = { title: 'Image audit' };

export default function ImageAuditPage() {
  return (
    <main className="page-shell">
      <header className="page-heading">
        <p className="eyebrow">Catalogue operations</p>
        <h1>Image<br/>audit.</h1>
        <p>Every product and homepage image. Canonical first. Local fallback ready.</p>
      </header>
      <ProductImageAudit products={products} editorialAssets={editorialAssets} />
    </main>
  );
}
