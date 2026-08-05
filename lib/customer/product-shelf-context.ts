import type { CustomerPortalShelfItem } from './portal-model';

/**
 * Explicit Shelf context for one product.
 *
 * - `saved-current`: the product is on the Shelf with an active, current identity.
 * - `saved-changed`: the product was saved but its identity changed (merged/superseded/retired).
 * - `not-saved`: the product is not on the Shelf.
 * - `unavailable`: the Shelf service is unavailable.
 */
export type ProductShelfContext =
  | { state: 'saved-current'; shelfItem: CustomerPortalShelfItem }
  | { state: 'saved-changed'; shelfItem: CustomerPortalShelfItem }
  | { state: 'not-saved' }
  | { state: 'unavailable'; message: string };

/**
 * Derive Shelf context for a product from Shelf items.
 *
 * A saved changed, merged, superseded or retired identity remains visible
 * as saved-changed context requiring review — it is not collapsed into not-saved.
 */
export function deriveProductShelfContext(
  shelfItems: readonly CustomerPortalShelfItem[],
  productSlug: string,
  shelfAvailable: boolean,
  shelfUnavailableMessage: string | null,
): ProductShelfContext {
  if (!shelfAvailable) {
    return { state: 'unavailable', message: shelfUnavailableMessage ?? 'Shelf unavailable' };
  }

  const matching = shelfItems.find(item =>
    item.product?.slug === productSlug
    || item.snapshot.slug === productSlug,
  );

  if (!matching) {
    return { state: 'not-saved' };
  }

  if (matching.availability === 'available' && matching.lifecycleState === 'active') {
    return { state: 'saved-current', shelfItem: matching };
  }

  return { state: 'saved-changed', shelfItem: matching };
}

/**
 * Human-readable label for the Shelf context.
 */
export function shelfContextLabel(context: ProductShelfContext): string {
  switch (context.state) {
    case 'saved-current':
      return 'On my Shelf';
    case 'saved-changed':
      return 'Saved version changed';
    case 'not-saved':
      return 'Not on my Shelf';
    case 'unavailable':
      return 'Shelf unavailable';
  }
}
