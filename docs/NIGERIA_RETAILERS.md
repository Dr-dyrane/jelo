# Nigeria retailer reference

JeloCare is a product information and routing layer. It does not manufacture, relabel or visually recreate branded products.

## Display rules

- Nigeria is the default market. United States is secondary.
- Show a price only after the retailer page matches brand, product, strength and size.
- Send exact matches to the exact product page.
- Keep retailer search links separate from priced offers.
- Show stock and the last checked date beside a verified price.
- Keep unavailable exact matches visible after available options.
- Treat marketplace results as seller-dependent and rank them below direct retailers.
- Never infer authenticity from price alone or promise authenticity on a retailer's behalf.
- Refresh exact prices within seven days. A stale observation may remain in history but should not be presented as current.
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
- Slique Beauty — <https://sliquebeautylimited.com/>
- Choices Beauty — <https://choiceschi.com/>
- Jumia Nigeria — <https://www.jumia.com.ng/>

## Initial exact observations

The dated source records live in `data/retail-offers.ts`. The current pass covers 16 catalogue products across direct Nigerian retailers and seller-dependent marketplaces. Each observation stores the exact retailer URL, price, stock state and check date. Marketplace offers also retain the visible seller name, seller score and quantity when available. Search pages are not promoted into exact offers, and non-Nigerian stores are excluded from Nigeria results.
