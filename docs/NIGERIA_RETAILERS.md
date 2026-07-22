# Nigeria retailer reference

JeloCare is a product information and routing layer. It does not manufacture, relabel or visually recreate branded products.

## Display rules

- Nigeria is the default market. United States is secondary.
- Show a price only after the retailer page or API record matches brand, product, variant, strength and size.
- Send exact matches to the exact product page.
- Keep retailer search links separate from priced offers.
- Show stock, observation timestamp and landed-cost caveat beside an observed price.
- Keep unavailable exact matches visible after available options.
- Treat marketplace results as seller-dependent and rank them below direct retailers.
- A checked listing, seller identity, regulator-number match and brand authorization are separate evidence records.
- A visible seller name or rating is not a seller-identity check.
- Record brand authorization only from a dated brand-controlled source.
- Never infer physical authenticity from any listing, price, rating or registration record.
- Refresh exact prices within seven days. A stale observation may remain in history but should not be presented as current.
- Re-observe catalogue regulatory evidence from NAFDAC within 90 days; stale matches and exemptions return to a private hold.
- Preserve offer IDs during catalogue seeds so price history remains continuous.

## Reviewed Nigeria sources

The runtime registry is `data/retailers.ts`. The initial reviewed set is:

- Beauty by Daz — <https://beautybydaz.com/>
- Teeka4 — <https://teeka4.com/>
- Lush Hair Nigeria — <https://nigeria.lushhairafrica.com/>
- Lux Beauty — <https://www.luxbeautyng.com/>
- MakeupAlleyNG — <https://makeupalleyng.com/>
- CSi Grocery — <https://www.csigrocery.com/skincare/>
- Konga Health — <https://www.konga.com/content/health>
- Deoset — <https://deoset.com/>
- Nectar Beauty Hub — <https://nectarbeautyhub.com/>
- Perona Beauty — <https://peronabeauty.com/>
- Allure Beauty — <https://allure.com.ng/>
- BabesQuarters — <https://babesquarters.ng/>
- AGT Plaza — <https://www.agtplaza.com/>
- Slique Beauty — <https://sliquebeautylimited.com/> — provisional, link-only; no asset reuse, regulator match or brand-authorization evidence
- Choices Beauty — <https://choiceschi.com/>
- Jumia Nigeria — <https://www.jumia.com.ng/>

## Initial exact observations

The dated source records live in `data/retail-offers.ts`. Each current observation stores the exact retailer URL, observed price, variant, size, stock state, timestamp and whether landed cost is known. Marketplace offers may retain a visible seller name, score and quantity, but those fields do not become identity evidence. Search pages are not promoted into exact offers, and non-Nigerian stores are excluded from Nigeria results.

These runtime observations are not publication evidence by themselves. The private intake gate additionally requires a reviewer-attributed, digest-bound listing representation with explicit manufacturer-number, title, size, adjacent NGN price and stock locators. A brand-authorized one-offer route also binds the exact seller and host excerpt from the brand-controlled response.

## Batch discovery inputs

The private discovery screen currently reads public product API pages from BuyBetter, Lux Beauty and provisional Slique Beauty. It captured 3,794 Nigerian retailer records across 39 decoded JSON responses and selected 1,000 category-balanced leads with measurable sizes, positive NGN prices and exact product routes.

This is a fast research index, not an exact-offer registry. WooCommerce `sku` values remain retailer fields even when they have a valid GTIN checksum; manufacturer identity must still come from a reviewed official source. API image URLs remain link-only leads, not permission to copy or publish them. Prices and stock become user-visible only through the separate exact runtime observation rules, and no discovery record can enter public catalogue code.
