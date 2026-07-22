import type { Offer } from '@/data/products';
import { rankOffers as rankWithPolicy } from '@/modules/commerce/offer-selection';

export function rankOffers(offers: Offer[], country: string, now: number | Date = Date.now()) {
  return rankWithPolicy(offers, country, now);
}
