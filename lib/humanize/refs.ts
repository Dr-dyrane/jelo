import { productBySlug, reviewedProductRecords } from '@/data/catalogue';

// A subject reference — "product:anua-niacinamide-10-txa-4-serum", a brand, or a
// bare contribution UUID — resolved into something human. Resolve in an RSC
// (the catalogue is server data) and pass the plain object to client chips.
export interface HumanRef {
  kind: 'product' | 'brand' | 'retailer' | 'purpose' | 'anonymous';
  slug: string;
  name: string;
  brand?: string;
  image?: string;
  displayApproved: boolean;
  raw: string;
}

// Resolves a product slug over the display-approved catalogue first (carries the
// reviewed transparent image), then the reviewed superset (name + brand only —
// its image is unreviewed, so callers placeholder the thumbnail).
export function resolveProductRef(slug: string):
  { name: string; brand: string; slug: string; image?: string; displayApproved: boolean } | null {
  const approved = productBySlug(slug);
  if (approved) {
    return { name: approved.name, brand: approved.brand, slug, image: approved.image, displayApproved: true };
  }
  const reviewed = reviewedProductRecords.find(product => product.slug === slug);
  if (reviewed) {
    return { name: reviewed.name, brand: reviewed.brand, slug, displayApproved: false };
  }
  return null;
}

function titleCase(value: string): string {
  return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()).trim();
}

export function humanizeRef(ref: string): HumanRef {
  const separator = ref.indexOf(':');
  if (separator === -1) {
    // A bare id is an anonymous contribution subject — nothing to resolve.
    return { kind: 'anonymous', slug: ref, name: ref.slice(0, 8), displayApproved: false, raw: ref };
  }

  const kind = ref.slice(0, separator);
  const rest = ref.slice(separator + 1);

  if (kind === 'product') {
    const resolved = resolveProductRef(rest);
    if (resolved) {
      return {
        kind: 'product',
        slug: rest,
        name: resolved.name,
        brand: resolved.brand,
        image: resolved.image,
        displayApproved: resolved.displayApproved,
        raw: ref,
      };
    }
    return { kind: 'product', slug: rest, name: titleCase(rest), displayApproved: false, raw: ref };
  }

  if (kind === 'brand' || kind === 'retailer' || kind === 'purpose') {
    return { kind, slug: rest, name: titleCase(rest), displayApproved: false, raw: ref };
  }

  return { kind: 'anonymous', slug: rest, name: titleCase(rest), displayApproved: false, raw: ref };
}
