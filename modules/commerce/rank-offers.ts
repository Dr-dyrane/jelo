import type { Offer } from '@/data/products';
import { rankOffers as rankWithPolicy, type RankingPreferences } from '@/modules/commerce/offer-selection';

export function rankOffers(
  offers: Offer[],
  country: string,
  now: number | Date = Date.now(),
  preferences?: RankingPreferences,
) {
  return rankWithPolicy(offers, country, now, preferences);
}
