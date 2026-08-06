# NINELESS A-Control Azelaic Acid Cream 50ml — research note

This note is candidate-scoped research for discovery
`f234692457fb9dcea6ab4000`. It is not a catalogue candidate, approval, or
publication instruction.

## Identity finding

- Canonical visible name: **NINELESS A-Control Azelaic Acid Cream**.
- Size: **50 ml**.
- GTIN-13: **8809875270189**.
- Official source: `https://ninelessshop.com/products/a-control-azelaic-acid-cream`
  - Official Shopify product variant has `"barcode":null` and `"sku":""`.
  - Product title: "[A-CONTROL] Azelaic Acid Cream 50ml"
- Independent EAN corroboration (2 sources):
  1. Qudo Beauty (`qudobeauty.com`) — "EAN: 8809875270189"
  2. TSMPK (`tsmpk.com`) — "UPC: 8809875270189"
- Identity evidence snapshot written to
  `data/catalogue-identity-evidence/nineless-a-control-azelaic-acid-cream-50ml.json`
  with Playwright MCP browser captures of all three pages.
- Identity basis: **official-brand** with independent EAN corroboration.

## Image blocker

- Official Shopify CDN images are all **1500 × 1500** (below the 1600 px
  publication minimum).
- Main product image (position 1, 900 × 900):
  `https://cdn.shopify.com/s/files/1/0614/5215/7184/files/2_f2126e7c-4b8a-42e8-b83e-90c55db8d27a.png?v=1782283483`
- Main banner (position 2, 1500 × 1500):
  `https://cdn.shopify.com/s/files/1/0614/5215/7184/files/1.MainBanner.png?v=1781858601`
- Route: **identity-verified-render** (image generation required).
- No image generation tool is available in the current session.

## Nigerian offer blocker

Both observed Nigerian retailers are **out of stock** as of 2026-08-06:

| Retailer | URL | Price | Stock | SKU |
| --- | --- | ---: | --- | --- |
| Beauty by Daz | `beautybydaz.com/shop/asian-brands/nineless-a-control-azelaic-acid-cream-50ml/` | ₦13,500 | **Out of stock** | 611-1-byd |
| BuyBetter | `buybetter.ng/product/nineless-a-control-azelaic-acid-cream-50ml/` | ₦11,150 | **Out of stock** | BB-N-330720 |

The generation specification verifier requires the candidate to be at the
`rights` stage, which requires passing the `nigeria` stage. With no fresh
in-stock exact offers, the candidate remains at the `nigeria` stage and
cannot receive a generation specification.

## Care review (draft)

- Formula archetype: leave-on facial cream with azelaic acid (~10,000 ppm),
  panthenol, snail secretion filtrate, lactic acid, green tea and pine leaf
  extracts.
- Care tier: **daily-care** (supportive, not treatment).
- Advisory boundary: A cosmetic moisturiser, not treatment for acne,
  dermatitis, or another skin condition. Azelaic acid and blemish-safe
  language does not guarantee tolerance for every person. Reduce or stop
  use if redness, burning, or persistent irritation develops. Persistent,
  painful, or unexplained skin changes need clinical review.
- Manufacturer evidence URL:
  `https://ninelessshop.com/products/a-control-azelaic-acid-cream`
- Independent clinical guidance URL:
  `https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101`

## Next action

1. **Wait for restock** at one or both Nigerian retailers. When at least
   one retailer has the product in stock, bind the exact offer with a
   Playwright MCP browser capture.
2. For the tier-a market route (enabling full publication), need 2+
   retailers from 2+ hosts with in-stock offers. Currently both are out
   of stock.
3. For reference-only publication, need at least 1 in-stock offer to pass
   the nigeria stage and reach the rights stage for the generation
   specification.
4. Once the image sublane is unblocked (either by restock enabling the
   generation specification, or by an image-capable operator returning
   a completed packshot), proceed with the normal release lane.
5. The identity evidence snapshot at
   `data/catalogue-identity-evidence/nineless-a-control-azelaic-acid-cream-50ml.json`
   is ready and can be reused without repeating the identity research.
