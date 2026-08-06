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

  const matching = shelfItems.filter(item =>
    item.product?.slug === productSlug
    || item.snapshot.slug === productSlug,
  );

  if (!matching.length) {
    return { state: 'not-saved' };
  }

  // Prefer saved-current (active, available) over saved-changed. When multiple
  // identity records correspond to one slug, the current identity wins.
  const current = matching.find(item =>
    item.availability === 'available' && item.lifecycleState === 'active',
  );
  if (current) {
    return { state: 'saved-current', shelfItem: current };
  }

  // No current identity — select the most relevant changed identity deterministically:
  // the most recently saved item.
  const changed = matching.reduce((latest, item) =>
    item.savedAt > latest.savedAt ? item : latest,
  );
  return { state: 'saved-changed', shelfItem: changed };
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
