import { ProductImageAudit } from '@/components/products/product-image-audit';
import { editorialAssets } from '@/data/editorial';
import { listCatalogueProducts } from '@/lib/catalogue/repository';

export const metadata = { title: 'Image audit' };

export default async function ImageAuditPage() {
  const products = await listCatalogueProducts();

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
