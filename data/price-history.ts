/**
 * Static price history for fallback trend calculation when no database is
 * available. Each entry records a previous price observation for a specific
 * product + retailer pair, with the date it was observed.
 *
 * This is seeded from git history — prices that changed between offer
 * verification batches. When the database is configured, this file is not
 * used; the `offer_price_history` table provides richer, ongoing history.
 *
 * The `oldDate` should be within the 7-day or 30-day trend window relative
 * to the current `observedAt` on the offer. If the actual observation date
 * falls outside the window, the trend function will not detect a movement.
 * We use the actual date the old price was observed — if it doesn't fall in
 * a window, no movement is reported for that window, which is honest.
 */
export type StaticPriceObservation = {
  productSlug: string;
  retailer: string;
  oldPriceNgn: number;
  oldObservedAt: string;
};

export const staticPriceHistory: StaticPriceObservation[] = [
  // advanced-clinicals-vitamin-c-face-serum-52ml (drop, 2 retailers)
  {
    productSlug: "advanced-clinicals-vitamin-c-face-serum-52ml",
    retailer: "BuyBetter",
    oldPriceNgn: 13320,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "advanced-clinicals-vitamin-c-face-serum-52ml",
    retailer: "Nihet Beauty",
    oldPriceNgn: 45425,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml (drop, 2 retailers)
  {
    productSlug: "anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml",
    retailer: "Beauty by Daz",
    oldPriceNgn: 21301,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "anua-azelaic-acid-10-hyaluron-redness-soothing-serum-30ml",
    retailer: "BuyBetter",
    oldPriceNgn: 19800,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // anua-niacinamide-10-txa-4-serum (drop, 3 retailers)
  {
    productSlug: "anua-niacinamide-10-txa-4-serum",
    retailer: "BuyBetter",
    oldPriceNgn: 18625,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "anua-niacinamide-10-txa-4-serum",
    retailer: "Jumia",
    oldPriceNgn: 8639,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "anua-niacinamide-10-txa-4-serum",
    retailer: "Teeka4",
    oldPriceNgn: 20160,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // anua-zero-cast-moisturizing-finish-sunscreen-50ml (increase, 2 retailers)
  {
    productSlug: "anua-zero-cast-moisturizing-finish-sunscreen-50ml",
    retailer: "BuyBetter",
    oldPriceNgn: 13845,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "anua-zero-cast-moisturizing-finish-sunscreen-50ml",
    retailer: "Nihet Beauty",
    oldPriceNgn: 33840,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // aqua-rich-ceramide-body-lotion-500ml (drop, 2 retailers)
  {
    productSlug: "aqua-rich-ceramide-body-lotion-500ml",
    retailer: "BuyBetter",
    oldPriceNgn: 14592,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "aqua-rich-ceramide-body-lotion-500ml",
    retailer: "CSi Grocery",
    oldPriceNgn: 14170,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // aqua-rich-turmeric-vitamin-c-body-lotion-500ml (increase, 2 retailers)
  {
    productSlug: "aqua-rich-turmeric-vitamin-c-body-lotion-500ml",
    retailer: "BuyBetter",
    oldPriceNgn: 11008,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "aqua-rich-turmeric-vitamin-c-body-lotion-500ml",
    retailer: "Kadimez Essentials",
    oldPriceNgn: 10440,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // balance-niacinamide-blemish-recovery-serum-30ml (drop, 4 retailers)
  {
    productSlug: "balance-niacinamide-blemish-recovery-serum-30ml",
    retailer: "BuyBetter",
    oldPriceNgn: 9492,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "balance-niacinamide-blemish-recovery-serum-30ml",
    retailer: "CSi Grocery",
    oldPriceNgn: 11556,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "balance-niacinamide-blemish-recovery-serum-30ml",
    retailer: "Deoset",
    oldPriceNgn: 9975,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "balance-niacinamide-blemish-recovery-serum-30ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 9900,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // balance-salicylic-acid-zinc-clarifying-toner-200ml (increase, 4 retailers)
  {
    productSlug: "balance-salicylic-acid-zinc-clarifying-toner-200ml",
    retailer: "24Eleven",
    oldPriceNgn: 8556,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "balance-salicylic-acid-zinc-clarifying-toner-200ml",
    retailer: "BuyBetter",
    oldPriceNgn: 7980,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "balance-salicylic-acid-zinc-clarifying-toner-200ml",
    retailer: "Deoset",
    oldPriceNgn: 9345,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "balance-salicylic-acid-zinc-clarifying-toner-200ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 7920,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // beauty-formulas-glowing-serum-2-vitamin-c-30ml (drop, 3 retailers)
  {
    productSlug: "beauty-formulas-glowing-serum-2-vitamin-c-30ml",
    retailer: "24Eleven",
    oldPriceNgn: 4294,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "beauty-formulas-glowing-serum-2-vitamin-c-30ml",
    retailer: "Beauty by Daz",
    oldPriceNgn: 4559,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "beauty-formulas-glowing-serum-2-vitamin-c-30ml",
    retailer: "CSi Grocery",
    oldPriceNgn: 3795,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cecred-moisturizing-deep-conditioner-300ml (increase, 2 retailers)
  {
    productSlug: "cecred-moisturizing-deep-conditioner-300ml",
    retailer: "BuyBetter",
    oldPriceNgn: 120185,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cecred-moisturizing-deep-conditioner-300ml",
    retailer: "GlowMart",
    oldPriceNgn: 141550,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cerave-acne-foaming-cream-cleanser-4-150ml (drop, 2 retailers)
  {
    productSlug: "cerave-acne-foaming-cream-cleanser-4-150ml",
    retailer: "BuyBetter",
    oldPriceNgn: 25200,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-acne-foaming-cream-cleanser-4-150ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 36225,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cerave-acne-foaming-cream-wash-10-150ml (increase, 5 retailers)
  {
    productSlug: "cerave-acne-foaming-cream-wash-10-150ml",
    retailer: "Beauty by Daz",
    oldPriceNgn: 21942,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-acne-foaming-cream-wash-10-150ml",
    retailer: "BuyBetter",
    oldPriceNgn: 20880,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-acne-foaming-cream-wash-10-150ml",
    retailer: "Deoset",
    oldPriceNgn: 22620,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-acne-foaming-cream-wash-10-150ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 26700,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-acne-foaming-cream-wash-10-150ml",
    retailer: "Teeka4",
    oldPriceNgn: 22785,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cerave-blemish-control-cleanser (drop, 2 retailers)
  {
    productSlug: "cerave-blemish-control-cleanser",
    retailer: "Perona Beauty",
    oldPriceNgn: 17670,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-blemish-control-cleanser",
    retailer: "Teeka4",
    oldPriceNgn: 15836,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cerave-hydrating-cleanser-473ml (drop, 3 retailers)
  {
    productSlug: "cerave-hydrating-cleanser-473ml",
    retailer: "BuyBetter",
    oldPriceNgn: 16639,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-hydrating-cleanser-473ml",
    retailer: "Deoset",
    oldPriceNgn: 23760,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-hydrating-cleanser-473ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 16895,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cerave-moisturising-cream-454g (increase, 4 retailers)
  {
    productSlug: "cerave-moisturising-cream-454g",
    retailer: "BuyBetter",
    oldPriceNgn: 17583,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-moisturising-cream-454g",
    retailer: "Deoset",
    oldPriceNgn: 29670,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-moisturising-cream-454g",
    retailer: "Nectar Beauty Hub",
    oldPriceNgn: 19800,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-moisturising-cream-454g",
    retailer: "Perona Beauty",
    oldPriceNgn: 18705,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cerave-pm-facial-moisturising-lotion-52ml (drop, 2 retailers)
  {
    productSlug: "cerave-pm-facial-moisturising-lotion-52ml",
    retailer: "Care to Beauty",
    oldPriceNgn: 35969,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-pm-facial-moisturising-lotion-52ml",
    retailer: "Dunes Center",
    oldPriceNgn: 50825,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cerave-sa-smoothing-cleanser-473ml (increase, 5 retailers)
  {
    productSlug: "cerave-sa-smoothing-cleanser-473ml",
    retailer: "24Eleven",
    oldPriceNgn: 21896,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-sa-smoothing-cleanser-473ml",
    retailer: "BuyBetter",
    oldPriceNgn: 19088,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-sa-smoothing-cleanser-473ml",
    retailer: "Deoset",
    oldPriceNgn: 24080,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-sa-smoothing-cleanser-473ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 21291,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cerave-sa-smoothing-cleanser-473ml",
    retailer: "Teeka4",
    oldPriceNgn: 18601,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // cosrx-advanced-snail-96-mucin-power-essence (drop, 2 retailers)
  {
    productSlug: "cosrx-advanced-snail-96-mucin-power-essence",
    retailer: "Care to Beauty",
    oldPriceNgn: 46118,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "cosrx-advanced-snail-96-mucin-power-essence",
    retailer: "Lux Beauty",
    oldPriceNgn: 14136,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // dang-azelaic-acid-serum-30ml (increase, 2 retailers)
  {
    productSlug: "dang-azelaic-acid-serum-30ml",
    retailer: "Konga Health",
    oldPriceNgn: 34830,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "dang-azelaic-acid-serum-30ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 16764,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // disaar-argan-oil-body-oil-gel (drop, 2 retailers)
  {
    productSlug: "disaar-argan-oil-body-oil-gel",
    retailer: "Choices Beauty",
    oldPriceNgn: 4320,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "disaar-argan-oil-body-oil-gel",
    retailer: "Jumia",
    oldPriceNgn: 4950,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // dove-calming-moisture-body-wash-547ml (increase, 2 retailers)
  {
    productSlug: "dove-calming-moisture-body-wash-547ml",
    retailer: "BuyBetter",
    oldPriceNgn: 19436,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "dove-calming-moisture-body-wash-547ml",
    retailer: "Deoset",
    oldPriceNgn: 22000,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // dove-melanin-even-tone-body-wash-18-5oz (drop, 2 retailers)
  {
    productSlug: "dove-melanin-even-tone-body-wash-18-5oz",
    retailer: "BuyBetter",
    oldPriceNgn: 23730,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "dove-melanin-even-tone-body-wash-18-5oz",
    retailer: "Perona Beauty",
    oldPriceNgn: 22000,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // dove-skin-replenish-serum-body-wash-547ml (increase, 3 retailers)
  {
    productSlug: "dove-skin-replenish-serum-body-wash-547ml",
    retailer: "BuyBetter",
    oldPriceNgn: 19210,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "dove-skin-replenish-serum-body-wash-547ml",
    retailer: "Deoset",
    oldPriceNgn: 22950,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "dove-skin-replenish-serum-body-wash-547ml",
    retailer: "Kadimez Essentials",
    oldPriceNgn: 21805,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // eucerin-oil-control-sun-gel-cream-spf50-50ml (drop, 3 retailers)
  {
    productSlug: "eucerin-oil-control-sun-gel-cream-spf50-50ml",
    retailer: "Beauty by Daz",
    oldPriceNgn: 20735,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "eucerin-oil-control-sun-gel-cream-spf50-50ml",
    retailer: "Deoset",
    oldPriceNgn: 24970,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "eucerin-oil-control-sun-gel-cream-spf50-50ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 22363,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // eucerin-urearepair-plus-10-urea-body-lotion-250ml (increase, 4 retailers)
  {
    productSlug: "eucerin-urearepair-plus-10-urea-body-lotion-250ml",
    retailer: "BuyBetter",
    oldPriceNgn: 23000,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "eucerin-urearepair-plus-10-urea-body-lotion-250ml",
    retailer: "Deoset",
    oldPriceNgn: 26255,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "eucerin-urearepair-plus-10-urea-body-lotion-250ml",
    retailer: "Jumia",
    oldPriceNgn: 24121,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "eucerin-urearepair-plus-10-urea-body-lotion-250ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 23144,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // face-facts-bright-clear-face-cream (drop, 2 retailers)
  {
    productSlug: "face-facts-bright-clear-face-cream",
    retailer: "Beauty by Daz",
    oldPriceNgn: 8025,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "face-facts-bright-clear-face-cream",
    retailer: "Perona Beauty",
    oldPriceNgn: 8769,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // face-facts-wonder-cream-fragrance-free (increase, 2 retailers)
  {
    productSlug: "face-facts-wonder-cream-fragrance-free",
    retailer: "Perona Beauty",
    oldPriceNgn: 6468,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "face-facts-wonder-cream-fragrance-free",
    retailer: "Teeka4",
    oldPriceNgn: 6699,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // facefacts-ceramide-blemish-gel-moisturiser-50ml (drop, 4 retailers)
  {
    productSlug: "facefacts-ceramide-blemish-gel-moisturiser-50ml",
    retailer: "Beauty by Daz",
    oldPriceNgn: 3710,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-blemish-gel-moisturiser-50ml",
    retailer: "BuyBetter",
    oldPriceNgn: 3681,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-blemish-gel-moisturiser-50ml",
    retailer: "Deoset",
    oldPriceNgn: 4905,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-blemish-gel-moisturiser-50ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 4520,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // facefacts-ceramide-foaming-cleanser-400ml (increase, 3 retailers)
  {
    productSlug: "facefacts-ceramide-foaming-cleanser-400ml",
    retailer: "24Eleven",
    oldPriceNgn: 6460,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-foaming-cleanser-400ml",
    retailer: "BuyBetter",
    oldPriceNgn: 5934,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-foaming-cleanser-400ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 6046,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // facefacts-ceramide-hydrating-gentle-cleanser-400ml (drop, 3 retailers)
  {
    productSlug: "facefacts-ceramide-hydrating-gentle-cleanser-400ml",
    retailer: "24Eleven",
    oldPriceNgn: 8322,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-hydrating-gentle-cleanser-400ml",
    retailer: "Beauty by Daz",
    oldPriceNgn: 7784,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-hydrating-gentle-cleanser-400ml",
    retailer: "Teeka4",
    oldPriceNgn: 8136,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // facefacts-ceramide-moisturising-gel-cream-50ml (increase, 3 retailers)
  {
    productSlug: "facefacts-ceramide-moisturising-gel-cream-50ml",
    retailer: "BuyBetter",
    oldPriceNgn: 3326,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-moisturising-gel-cream-50ml",
    retailer: "CSi Grocery",
    oldPriceNgn: 3276,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-moisturising-gel-cream-50ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 3432,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // facefacts-ceramide-oil-control-foaming-cleanser-400ml (drop, 3 retailers)
  {
    productSlug: "facefacts-ceramide-oil-control-foaming-cleanser-400ml",
    retailer: "24Eleven",
    oldPriceNgn: 7957,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-oil-control-foaming-cleanser-400ml",
    retailer: "BuyBetter",
    oldPriceNgn: 7637,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-ceramide-oil-control-foaming-cleanser-400ml",
    retailer: "Deoset",
    oldPriceNgn: 8970,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // facefacts-vitamin-c-body-lotion-400ml (increase, 4 retailers)
  {
    productSlug: "facefacts-vitamin-c-body-lotion-400ml",
    retailer: "Allure Beauty",
    oldPriceNgn: 7600,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-vitamin-c-body-lotion-400ml",
    retailer: "BuyBetter",
    oldPriceNgn: 5242,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-vitamin-c-body-lotion-400ml",
    retailer: "Deoset",
    oldPriceNgn: 5785,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "facefacts-vitamin-c-body-lotion-400ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 5461,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // garnier-vitamin-c-brightening-day-cream-50ml (drop, 4 retailers)
  {
    productSlug: "garnier-vitamin-c-brightening-day-cream-50ml",
    retailer: "BuyBetter",
    oldPriceNgn: 14510,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "garnier-vitamin-c-brightening-day-cream-50ml",
    retailer: "Deoset",
    oldPriceNgn: 14061,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "garnier-vitamin-c-brightening-day-cream-50ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 13493,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "garnier-vitamin-c-brightening-day-cream-50ml",
    retailer: "Teeka4",
    oldPriceNgn: 13253,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // keracare-dry-itchy-scalp-conditioner-950ml (increase, 2 retailers)
  {
    productSlug: "keracare-dry-itchy-scalp-conditioner-950ml",
    retailer: "BuyBetter",
    oldPriceNgn: 33097,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "keracare-dry-itchy-scalp-conditioner-950ml",
    retailer: "Ediths Essentials",
    oldPriceNgn: 38267,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // la-roche-posay-anthelios-uvmune-400-oil-control-fluid (drop, 2 retailers)
  {
    productSlug: "la-roche-posay-anthelios-uvmune-400-oil-control-fluid",
    retailer: "Deoset",
    oldPriceNgn: 27246,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "la-roche-posay-anthelios-uvmune-400-oil-control-fluid",
    retailer: "Teeka4",
    oldPriceNgn: 22140,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // la-roche-posay-effaclar-purifying-foaming-gel-400ml (increase, 4 retailers)
  {
    productSlug: "la-roche-posay-effaclar-purifying-foaming-gel-400ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 21669,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "la-roche-posay-effaclar-purifying-foaming-gel-400ml",
    retailer: "Rhema Beauty Shop",
    oldPriceNgn: 15114,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "la-roche-posay-effaclar-purifying-foaming-gel-400ml",
    retailer: "Teeka4",
    oldPriceNgn: 18479,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "la-roche-posay-effaclar-purifying-foaming-gel-400ml",
    retailer: "The Beauty Prism",
    oldPriceNgn: 22560,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // laroche-posay-mela-b3-serum-30ml (drop, 4 retailers)
  {
    productSlug: "laroche-posay-mela-b3-serum-30ml",
    retailer: "Deoset",
    oldPriceNgn: 51516,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "laroche-posay-mela-b3-serum-30ml",
    retailer: "Dunes Center",
    oldPriceNgn: 142945,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "laroche-posay-mela-b3-serum-30ml",
    retailer: "Lux Beauty",
    oldPriceNgn: 52865,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "laroche-posay-mela-b3-serum-30ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 50140,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // mediana-leave-in-conditioning-milk (increase, 2 retailers)
  {
    productSlug: "mediana-leave-in-conditioning-milk",
    retailer: "Jumia",
    oldPriceNgn: 1720,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "mediana-leave-in-conditioning-milk",
    retailer: "Slique Beauty",
    oldPriceNgn: 20475,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // medik8-crystal-retinal-3-30ml (drop, 2 retailers)
  {
    productSlug: "medik8-crystal-retinal-3-30ml",
    retailer: "Skincare Plug NG",
    oldPriceNgn: 152250,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "medik8-crystal-retinal-3-30ml",
    retailer: "Teeka4",
    oldPriceNgn: 99780,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // medik8-crystal-retinal-6-30ml (increase, 2 retailers)
  {
    productSlug: "medik8-crystal-retinal-6-30ml",
    retailer: "Jumia",
    oldPriceNgn: 167790,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "medik8-crystal-retinal-6-30ml",
    retailer: "My Skin Hub NG",
    oldPriceNgn: 157080,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // naturium-the-perfector-salicylic-acid-body-wash-500ml (drop, 4 retailers)
  {
    productSlug: "naturium-the-perfector-salicylic-acid-body-wash-500ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 46110,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "naturium-the-perfector-salicylic-acid-body-wash-500ml",
    retailer: "Rhema Beauty Shop",
    oldPriceNgn: 50385,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "naturium-the-perfector-salicylic-acid-body-wash-500ml",
    retailer: "TOS Nigeria",
    oldPriceNgn: 47880,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "naturium-the-perfector-salicylic-acid-body-wash-500ml",
    retailer: "The Beauty Prism",
    oldPriceNgn: 45050,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // nineless-a-control-10-azelaic-acid-serum-30ml (increase, 4 retailers)
  {
    productSlug: "nineless-a-control-10-azelaic-acid-serum-30ml",
    retailer: "Beauty by Daz",
    oldPriceNgn: 10750,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nineless-a-control-10-azelaic-acid-serum-30ml",
    retailer: "BuyBetter",
    oldPriceNgn: 12760,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nineless-a-control-10-azelaic-acid-serum-30ml",
    retailer: "Deoset",
    oldPriceNgn: 12580,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nineless-a-control-10-azelaic-acid-serum-30ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 12006,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // nineless-mela-pro-rice-txa-toner-200ml (drop, 4 retailers)
  {
    productSlug: "nineless-mela-pro-rice-txa-toner-200ml",
    retailer: "BuyBetter",
    oldPriceNgn: 17205,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nineless-mela-pro-rice-txa-toner-200ml",
    retailer: "Deoset",
    oldPriceNgn: 20470,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nineless-mela-pro-rice-txa-toner-200ml",
    retailer: "Muna Cosmetics",
    oldPriceNgn: 19950,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nineless-mela-pro-rice-txa-toner-200ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 17172,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // nivea-perfect-radiant-body-lotion-400ml (increase, 3 retailers)
  {
    productSlug: "nivea-perfect-radiant-body-lotion-400ml",
    retailer: "Allure Beauty",
    oldPriceNgn: 6045,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nivea-perfect-radiant-body-lotion-400ml",
    retailer: "Deoset",
    oldPriceNgn: 6110,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "nivea-perfect-radiant-body-lotion-400ml",
    retailer: "Teeka4",
    oldPriceNgn: 5339,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // olay-super-serum-body-wash-normal-skin-547ml (drop, 2 retailers)
  {
    productSlug: "olay-super-serum-body-wash-normal-skin-547ml",
    retailer: "BuyBetter",
    oldPriceNgn: 22430,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "olay-super-serum-body-wash-normal-skin-547ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 23320,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml (increase, 2 retailers)
  {
    productSlug:
      "sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml",
    retailer: "BuyBetter",
    oldPriceNgn: 11636,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug:
      "sheamoisture-raw-shea-butter-deep-moisturizing-conditioner-384ml",
    retailer: "Jumia",
    oldPriceNgn: 30444,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // simple-kind-to-skin-refreshing-facial-gel-wash-150ml (drop, 4 retailers)
  {
    productSlug: "simple-kind-to-skin-refreshing-facial-gel-wash-150ml",
    retailer: "CSi Grocery",
    oldPriceNgn: 5472,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "simple-kind-to-skin-refreshing-facial-gel-wash-150ml",
    retailer: "Deoset",
    oldPriceNgn: 6780,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "simple-kind-to-skin-refreshing-facial-gel-wash-150ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 5995,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "simple-kind-to-skin-refreshing-facial-gel-wash-150ml",
    retailer: "Teeka4",
    oldPriceNgn: 5699,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // skin-by-zaron-vitamin-c-body-lotion-500ml (increase, 3 retailers)
  {
    productSlug: "skin-by-zaron-vitamin-c-body-lotion-500ml",
    retailer: "BuyBetter",
    oldPriceNgn: 12580,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "skin-by-zaron-vitamin-c-body-lotion-500ml",
    retailer: "Deoset",
    oldPriceNgn: 14608,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "skin-by-zaron-vitamin-c-body-lotion-500ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 14450,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  // skin-by-zaron-vitamin-c-body-wash-650ml (drop, 4 retailers)
  {
    productSlug: "skin-by-zaron-vitamin-c-body-wash-650ml",
    retailer: "BuyBetter",
    oldPriceNgn: 13007,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "skin-by-zaron-vitamin-c-body-wash-650ml",
    retailer: "CSi Grocery",
    oldPriceNgn: 14000,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "skin-by-zaron-vitamin-c-body-wash-650ml",
    retailer: "Deoset",
    oldPriceNgn: 12810,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
  {
    productSlug: "skin-by-zaron-vitamin-c-body-wash-650ml",
    retailer: "Perona Beauty",
    oldPriceNgn: 14375,
    oldObservedAt: "2026-07-16T12:00:00Z",
  },
];
