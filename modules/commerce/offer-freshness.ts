import type { Offer } from '@/data/products';

export const OFFER_FRESH_DAYS = 7;
const dayMs = 24 * 60 * 60 * 1000;

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function isOfferFresh(offer: Pick<Offer, 'checkedAt'>, now: number | Date = Date.now()) {
  if (!offer.checkedAt) return false;
  const checked = new Date(offer.checkedAt);
  const current = typeof now === 'number' ? new Date(now) : now;
  if (Number.isNaN(checked.getTime()) || Number.isNaN(current.getTime())) return false;
  const ageDays = (utcDay(current) - utcDay(checked)) / dayMs;
  return ageDays >= 0 && ageDays <= OFFER_FRESH_DAYS;
}
