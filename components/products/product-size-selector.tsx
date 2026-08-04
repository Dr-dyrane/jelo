import Link from 'next/link';
import type { ResolvedCatalogueProductFamily } from '@/lib/catalogue/product-family';

type ProductSizeSelectorProps = {
  family: ResolvedCatalogueProductFamily<{
    slug: string;
    size: string;
    image: string;
    offers: readonly unknown[];
  }>;
};

export function ProductSizeSelector({ family }: ProductSizeSelectorProps) {
  return (
    <nav className="product-size-selector" aria-label="Available product sizes">
      <span className="product-size-selector-label">Size</span>
      <div className="product-size-selector-options">
        {family.members.map(member => {
          const selected = member.product.slug === family.current.product.slug;
          return (
            <Link
              key={member.product.slug}
              className="product-size-selector-option"
              href={`/products/${member.product.slug}`}
              aria-current={selected ? 'page' : undefined}
              data-package-form={member.packageForm}
            >
              {member.optionLabel}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
