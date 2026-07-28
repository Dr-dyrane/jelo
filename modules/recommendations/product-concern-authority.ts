import { concernBySlug, type Concern } from '@/data/knowledge';
import type { Product } from '@/data/products';
import type { ApprovedProductCareUse } from '@/data/product-care-review';

function categoryForConcernArea(area: Concern['area']) {
  if (area === 'Face') return 'Face';
  if (area === 'Body') return 'Body';
  return 'Hair';
}

export function approvedUseMatchesProductArea(
  product: Product,
  use: ApprovedProductCareUse,
  authorizedConcernSlugs: readonly string[],
  requestedProductSteps: readonly string[] = [],
) {
  const authorized = new Set(authorizedConcernSlugs);
  const requestedSteps = new Set(requestedProductSteps.map(step => step.trim().toLowerCase()));
  if (requestedSteps.size > 0 && !requestedSteps.has(product.step.trim().toLowerCase())) return false;

  return Boolean(use.concernSlugs?.some(slug => {
    if (!authorized.has(slug)) return false;
    const concern = concernBySlug(slug);
    return concern?.kind === 'concern' && categoryForConcernArea(concern.area) === product.category;
  }));
}
