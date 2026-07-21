export type BaselinePrice = {
  amount: number;
  currency: 'NGN';
  retailer: string;
  market: 'NG';
  checkedAt: string;
};

export const baselinePrices: Record<string, BaselinePrice> = {
  'cosrx-salicylic-acid-daily-gentle-cleanser': { amount: 22783.55, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' },
  'some-by-mi-aha-bha-pha-miracle-toner': { amount: 20808.42, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' },
  'anua-niacinamide-10-txa-4-serum': { amount: 36574.49, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' },
  'ogx-renewing-argan-oil-of-morocco': { amount: 16333.57, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' },
};

export function formatBaselinePrice(slug: string) {
  const price = baselinePrices[slug];
  if (!price) return 'See live price';
  return `From ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: price.currency, maximumFractionDigits: 0 }).format(price.amount)}`;
}
