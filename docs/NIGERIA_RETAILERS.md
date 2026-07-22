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

## Reviewed Nigeria sources

The runtime registry is `data/retailers.ts`. The initial reviewed set is:

- Beauty by Daz — <https://beautybydaz.com/>
- Teeka4 — <https://teeka4.com/>
- Lux Beauty — <https://www.luxbeautyng.com/>
- MakeupAlleyNG — <https://makeupalleyng.com/>
- CSi Grocery — <https://www.csigrocery.com/skincare/>
- Konga Health — <https://www.konga.com/content/health>
- Deoset — <https://deoset.com/>
- Nectar Beauty Hub — <https://nectarbeautyhub.com/>
- Perona Beauty — <https://peronabeauty.com/>
- Allure Beauty — <https://allure.com.ng/>
- BabesQuarters — <https://babesquarters.ng/>
- Jumia Nigeria — <https://www.jumia.com.ng/>

## Initial exact observations

The dated source records live in `data/retail-offers.ts`. This first pass covers nine catalogue products across Teeka4, Lux Beauty, Beauty by Daz and CSi Grocery. Each observation stores the exact retailer URL, price, stock state and check date. Search pages are not promoted into exact offers.
