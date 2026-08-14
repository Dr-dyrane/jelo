export const BASKET_STORAGE_KEY = 'jelocare:basket:v1';
export const BASKET_EVENT = 'jelocare:basket-change';
export const CHECKOUT_RETAILER_STORAGE_KEY = 'jelocare:checkout-retailer:v1';
export const CHECKOUT_REQUEST_STORAGE_KEY = 'jelocare:checkout-request:v1';
export const BASKET_MAX_PRODUCTS = 4;
export const BASKET_MAX_QUANTITY = 10;

export type BasketItem = { slug: string; quantity: number };
export type BasketAddOutcome = 'added' | 'quantity_increased' | 'product_limit_reached';

export function basketAddOutcome(
  items: readonly BasketItem[],
  slug: string,
): BasketAddOutcome {
  if (items.some(item => item.slug === slug)) return 'quantity_increased';
  return items.length >= BASKET_MAX_PRODUCTS
    ? 'product_limit_reached'
    : 'added';
}

export function normaliseBasketItems(value: unknown): BasketItem[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<string, number>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const slug = 'slug' in item && typeof item.slug === 'string' ? item.slug.trim() : '';
    const quantity = 'quantity' in item && typeof item.quantity === 'number'
      ? Math.trunc(item.quantity)
      : 0;
    if (!slug || quantity < 1) continue;
    quantities.set(slug, Math.min((quantities.get(slug) ?? 0) + quantity, BASKET_MAX_QUANTITY));
  }
  return Array.from(quantities, ([slug, quantity]) => ({ slug, quantity }))
    .slice(0, BASKET_MAX_PRODUCTS);
}

export function basketQuantity(items: readonly BasketItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function addBasketItem(items: readonly BasketItem[], slug: string): BasketItem[] {
  const existing = items.find(item => item.slug === slug);
  if (existing) {
    return items.map(item => item.slug === slug
      ? { ...item, quantity: Math.min(item.quantity + 1, BASKET_MAX_QUANTITY) }
      : item);
  }
  if (items.length >= BASKET_MAX_PRODUCTS) return [...items];
  return [...items, { slug, quantity: 1 }];
}

export function setBasketItemQuantity(
  items: readonly BasketItem[],
  slug: string,
  quantity: number,
): BasketItem[] {
  const next = Math.trunc(quantity);
  if (next < 1) return items.filter(item => item.slug !== slug);
  return items.map(item => item.slug === slug
    ? { ...item, quantity: Math.min(next, BASKET_MAX_QUANTITY) }
    : item);
}
