import type { Offer } from '@/data/products';

export const OFFER_FRESH_DAYS = 7;
const dayMs = 24 * 60 * 60 * 1000;

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function isOfferFresh(
  offer: Pick<Offer, 'checkedAt' | 'expiresAt' | 'priceObservation'>,
  now: number | Date = Date.now(),
) {
  const observedAt = offer.priceObservation?.observedAt ?? offer.checkedAt;
  if (!observedAt) return false;
  const checked = new Date(observedAt);
  const current = typeof now === 'number' ? new Date(now) : now;
  if (Number.isNaN(checked.getTime()) || Number.isNaN(current.getTime())) return false;
  if (checked.getTime() > current.getTime()) return false;

  if (offer.expiresAt) {
    const expires = new Date(offer.expiresAt);
    if (Number.isNaN(expires.getTime()) || expires.getTime() <= current.getTime()) return false;
  }

  const ageDays = (utcDay(current) - utcDay(checked)) / dayMs;
  return ageDays >= 0 && ageDays <= OFFER_FRESH_DAYS;
}
