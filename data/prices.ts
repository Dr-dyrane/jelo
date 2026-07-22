export type Market = 'NG' | 'US';
export type BaselinePrice = { amount: number; currency: 'NGN' | 'USD'; retailer: string; market: Market; checkedAt: string };

export const baselinePrices: Record<string, Partial<Record<Market, BaselinePrice>>> = {
  'cosrx-salicylic-acid-daily-gentle-cleanser': { NG: { amount: 22783.55, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' } },
  'some-by-mi-aha-bha-pha-miracle-toner': { NG: { amount: 20808.42, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' } },
  'anua-niacinamide-10-txa-4-serum': { NG: { amount: 36574.49, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' } },
  'ogx-renewing-argan-oil-of-morocco': { NG: { amount: 16333.57, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' } },
  'cerave-foaming-facial-cleanser': { NG: { amount: 23892.32, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' }, US: { amount: 16.99, currency: 'USD', retailer: 'Ulta Beauty', market: 'US', checkedAt: '2026-07-20' } },
  'cerave-blemish-control-cleanser': { NG: { amount: 28104.88, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' } },
  'the-ordinary-azelaic-acid-suspension-10': { US: { amount: 12.2, currency: 'USD', retailer: 'Ulta Beauty', market: 'US', checkedAt: '2026-07-20' } },
  'la-roche-posay-anthelios-uvmune-400-oil-control-fluid': { NG: { amount: 46872.99, currency: 'NGN', retailer: 'Care to Beauty', market: 'NG', checkedAt: '2026-07-20' } },
  'la-roche-posay-toleriane-double-repair-spf30': { US: { amount: 28.99, currency: 'USD', retailer: 'Ulta Beauty', market: 'US', checkedAt: '2026-07-20' } },
  'la-roche-posay-toleriane-double-repair-matte': { US: { amount: 27.99, currency: 'USD', retailer: 'Ulta Beauty', market: 'US', checkedAt: '2026-07-20' } },
  'cosrx-advanced-snail-96-mucin-power-essence': { US: { amount: 20.9, currency: 'USD', retailer: 'Ulta Beauty', market: 'US', checkedAt: '2026-07-20' } },
  'panoxyl-acne-foaming-wash-10-benzoyl-peroxide': { US: { amount: 13.49, currency: 'USD', retailer: 'Ulta Beauty', market: 'US', checkedAt: '2026-07-20' } }
};

export function inferMarket(): Market {
  if (typeof navigator === 'undefined') return 'NG';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return navigator.language.toLowerCase().includes('en-us') || zone.startsWith('America/') ? 'US' : 'NG';
}

export function formatBaselinePrice(slug: string, preferred: Market = 'NG') {
  const entry = baselinePrices[slug];
  const price = entry?.[preferred];
  if (!price) return 'Live price';
  return new Intl.NumberFormat(price.currency === 'NGN' ? 'en-NG' : 'en-US', { style: 'currency', currency: price.currency, maximumFractionDigits: price.currency === 'NGN' ? 0 : 2 }).format(price.amount);
}
