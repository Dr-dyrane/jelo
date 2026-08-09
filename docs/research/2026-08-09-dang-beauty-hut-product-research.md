# DANG! Lifestyle and Beauty Hut Africa product research

Updated: 2026-08-09

## Context

Promo week research for DANG! Lifestyle and Beauty Hut Africa. The goal is to
expand JeloCare's catalogue with DANG! Lifestyle products (a brand we already
carry 3 SKUs of) and understand Beauty Hut Africa's retail model for potential
brand/company page integration.

## Research methodology and tools

This research was performed using two web tools available to the agent:

1. **`web_search`** — Search engine queries returning titles, URLs, and
   summaries. Used for:
   - Discovering brand websites and online stores
   - Finding product catalog listings and promo announcements
   - Identifying third-party retailers carrying the brand's products
   - Finding press coverage and founder interviews for brand context

2. **`webfetch`** — Fetches a web page and returns its content as readable
   text. Used for:
   - Extracting full product catalogs from collection pages
   - Reading product details (titles, sizes, prices, ingredients, stock status)
   - Capturing brand about pages and company background
   - Parsing Shopify product JSON endpoints for structured data

### Research workflow

1. **Brand discovery** — `web_search` for "<brand> Nigeria skincare online
   store products" to find the official website and third-party retailers.
2. **Catalog enumeration** — `webfetch` the homepage and collection pages
   (`/collections/all`, `/collections/face-serums`, etc.) to enumerate every
   product with title, size, price, and sale status.
3. **Identity extraction** — Fetch the Shopify product JSON API
   (`/products/<handle>.json`) and the product page HTML to extract
   barcodes/GTINs, SKUs, and variant IDs. For DANG, barcodes are in the
   `"barcode"` field of the Shopify variant JSON embedded in the page HTML.
4. **Price and promo capture** — Record original and sale prices from the
   collection pages. DANG is running a "Mid-Year Sale" with ~15% off all
   products.
5. **Third-party retailer check** — `web_search` for the brand name on
   Nigerian retailer sites (Perona Beauty, Konga, Bracketts Beauty) to find
   existing exact offers for cross-referencing.
6. **Brand background** — `webfetch` the about page and `web_search` for
   press coverage and founder interviews to capture company history, store
   locations, and business model.

### What the tools capture vs what requires browser verification

| Data                          | Tool                               | Reliable for intake?                                                   |
| ----------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Product title, size, price    | `webfetch` collection page         | Yes — public catalog                                                   |
| Sale price and original price | `webfetch` collection page         | Yes — rendered strikethrough                                           |
| Barcode/GTIN                  | `curl` product page HTML + grep    | Yes — Shopify JSON-LD                                                  |
| Manufacturer SKU              | `curl` product page HTML + grep    | Yes — Shopify variant barcode                                          |
| Stock status                  | `webfetch` collection page         | Partial — "Sold Out" is visible, but live stock requires retailer page |
| Nigerian retailer offers      | `web_search` + `webfetch`          | No — requires Playwright MCP browser capture for evidence binding      |
| Product images                | Shopify CDN URLs from product JSON | Link-only — no permission to copy without asset review                 |

## DANG! Lifestyle

### Brand profile

- **Website:** https://danglifestyle.co
- **Founder/CEO:** Ifedayo Agoro (founded 2020 in Nigeria)
- **Contact:** customercare@danglifestyle.co
- **Locations:** Nigeria, UK, USA, Canada, Ghana, Kenya (5 physical stores)
- **Social:** Instagram @danglifestyle_, Twitter @danglifestyle_, Facebook
  /DANGLIFESTYLE1, TikTok, YouTube, Pinterest, Snapchat
- **Shipping:** Free on orders over ₦200,000 within Lagos
- **Platform:** Shopify (danglifestyle.co)
- **Retailer registry:** Already registered in `data/retailers.ts` as
  "DANG Lifestyle" with `directory-listed` review status

### Current promo: Mid-Year Sale

All products showing sale prices at ~15% off original. The sale is live on
the homepage with a "Mid-Year Sale is Live. Shop Now!" banner.

### Already in JeloCare catalogue (3 products, all live)

| Slug                                             | Product                                       | GTIN-13       |
| ------------------------------------------------ | --------------------------------------------- | ------------- |
| dang-azelaic-acid-serum-30ml                     | Azelaic Acid Serum 30ml                       | 6154000333867 |
| dang-hydra-glow-sun-protection-gel-60ml          | Hydra Glow Sun Protection Gel 60ml            | —             |
| dang-niacinamide-n-acetyl-glucosamine-serum-30ml | Niacinamide + N-Acetyl Glucosamine Serum 30ml | —             |

### New products researched (8 candidates with manufacturer SKUs)

All barcodes are manufacturer SKUs (DGL-SKC-xxx), not GTIN-13. The
manufacturer-SKU identity route is valid for reference-only publication
per the fast lane.

| Product                                    | Size  | SKU         | Original | Sale    | Category  |
| ------------------------------------------ | ----- | ----------- | -------- | ------- | --------- |
| Vitamin C Concentrated Serum (Oil Free)    | 30ml  | DGL-SKC-020 | ₦17,700  | ₦15,045 | Face care |
| Collagen & Hydrating Serum with Ceramides  | 30ml  | DGL-SKC-034 | ₦17,000  | ₦14,450 | Face care |
| Beauty Water (Toner)                       | 100ml | DGL-SKC-017 | ₦14,400  | ₦12,240 | Face care |
| Everyday Gentle Foaming Face Wash          | 120ml | DGL-SKC-031 | ₦15,500  | ₦13,175 | Face care |
| Snail Secretion Filtrate Repair Face Cream | 50g   | DGL-SKC-019 | ₦15,200  | ₦12,920 | Face care |
| Snail Mucin Repair Serum                   | 100ml | DGL-SKC-023 | ₦21,600  | ₦16,200 | Face care |
| Hyaluronic Cream Hydrating Face Cleanser   | 200ml | DGL-SKC-052 | ₦19,100  | ₦15,280 | Face care |
| Multipurpose Retinal Cream 0.05%           | 30ml  | DGL-SKC-030 | —        | —       | Face care |

### Products without barcodes (not yet candidates)

| Product                                                 | Handle                                                  | Notes                 |
| ------------------------------------------------------- | ------------------------------------------------------- | --------------------- |
| Q10+Vitamin C Face Oil Serum 30ml                       | coenzyme-q10-serum                                      | No barcode in Shopify |
| 5% Mandelic Acid 3-in-1 Foaming Face Wash 30ml          | 5-mandelic-acid-3-in-1-foaming-face-wash-30ml           | No barcode in Shopify |
| Exfoliating & Moisturising Shower Gel (White Tea) 450ml | exfoliating-and-moisturising-shower-gel-white-tea-450ml | No barcode in Shopify |

### Additional product categories (not skincare)

DANG also carries fragrance (diffusers, candles, perfumes), body oils, and
hair care. These are outside JeloCare's current skincare catalogue scope.

### Third-party Nigerian retailers carrying DANG

- **Perona Beauty** (peronabeauty.com) — confirmed carrying DANG Vitamin C
  Serum at ₦19,050 and Azelaic Acid Serum at ₦16,193
- **Konga Health** (konga.com) — confirmed carrying DANG Azelaic Acid Serum
  at ₦38,700
- **Bracketts Beauty** (brackettsbeauty.com) — confirmed carrying DANG
  Azelaic Acid Serum at ₦20,421.50 (retailer-SKU only, excluded from exact
  comparison)

## Beauty Hut Africa

### Brand profile

- **Website:** https://beautyhutafrica.com
- **Founder:** Subuola Oyeleye (founded November 24, 2023)
- **HQ:** Lagos, Nigeria (2 offices)
- **Funding:** $120K (Techstars '23)
- **Employees:** 11
- **Retailer registry:** Already registered in `data/retailers.ts` as
  "Beauty Hut Africa" with `directory-listed` review status

### Business model

Beauty Hut Africa is a **multi-brand beauty retailer/distributor**, not a
product brand. They curate international and local skincare/beauty brands
with a focus on:

- Products for people of color (hyperpigmentation, melanin-safe formulations)
- New and upcoming brands targeting Gen Z and Millennial audiences
- Exclusive distribution partnerships (Topicals exclusive Africa launch,
  COSRX distribution)

### Brands carried (30+)

International: CeraVe, COSRX, Topicals, La Roche-Posay, Good Molecules, The
Ordinary, Haruharu Wonder, Tree Hut, Garnier, Maybelline, Uncover, Eucerin,
Mary & May, St. Ives, Junederm, Minimal Rx, Dr. Althea, APLB, Galderma,
Timeless, Danessa Myricks, Toke Makinwa Beauty, Mizani.

African/local: Arami, R&R Skincare, Cape & Coco, Vive Hair Care, Nay Living,
Olori Cosmetics, ASAB, Sapphire by O, WHIFFWONDERS, Beauty by AD, Zaron.

### Shipping and offers

- Free Lagos delivery on orders above ₦75,000
- Same-day delivery in Lagos
- Exclusive offers on the Beauty Hut App
- Gift cards available

### Curated sets

- **Hut Essentials Set** — CeraVe Hydrating Cleanser, Haruharu Wonder Black
  Rice Toner, Timeless Vitamin C 20%, Toke Makinwa Mini Perfume, COSRX Airy
  Light Sunscreen, R&R Hand Cream, Topicals Slick Salve
- **Acne Cheat Set** — ₦73,000 (worth ₦146,000) — Haruharu Toner, CeraVe
  Foaming Cleanser, La Roche-Posay SPF50+, Topicals Clearly Mask + Mist,
  COSRX Pimple Patches

### JeloCare integration notes

Beauty Hut is already in the retailer registry but has no products in the
intake pipeline. Since Beauty Hut is a distributor (not a brand), the
integration path is:

1. Add Beauty Hut as an exact-offer source for brands they carry that are
   already in our catalogue (CeraVe, COSRX, La Roche-Posay, etc.)
2. The Beauty Hut website is a WooCommerce store — offers can be verified
   via the WooCommerce Store API at
   `beautyhutafrica.com/wp-json/wc/store/v1/products?search=<brand>`
3. A brand/company page for Beauty Hut would be a retailer profile page,
   not a product brand page

## Next steps

1. **DANG products** — 8 intake candidates created and registered in the
   pipeline at the `identity` stage. They use `community-aggregate-packet`
   origin with manufacturer-SKU canonical identifiers (DGL-SKC-xxx).
   **Blocker:** The manufacturer-SKU identity route (schemaVersion 8)
   requires `barcode === null` in the Shopify variant JSON. DANG puts the
   SKU in both the `sku` AND `barcode` fields, so the verifier rejects
   these candidates. The existing 3 released DANG products all had real
   GTIN-13s (6154000xxxxxx) in the barcode field and used the GTIN route
   (schemaVersion 3). The 8 new products have no published GTINs.
   This is a schema boundary — the verifier in
   `lib/catalogue/identity-evidence-artifact.ts` would need to be updated
   to accept a non-null barcode that matches the manufacturer SKU (not a
   GTIN). Per CLAUDE.md, this crosses the publication-gate boundary.
2. **Beauty Hut** — Add as an exact-offer source for existing catalogue
   brands (CeraVe, COSRX, La Roche-Posay). The WooCommerce Store API can
   automate offer discovery.
3. **DANG products without barcodes** — The 3 products without barcodes
   (Q10 serum, Mandelic wash, White Tea shower gel) cannot use any
   identity route. They need GTIN-13 extraction from the physical
   product packaging.
