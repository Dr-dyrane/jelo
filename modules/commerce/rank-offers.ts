import type { Offer } from '@/data/products';
import { rankOffers as rankWithPolicy } from '@/modules/commerce/offer-selection';

export function rankOffers(offers: Offer[], country: string) {
  return rankWithPolicy(offers, country);
}
