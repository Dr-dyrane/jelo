# Ingredient review

JeloCare distinguishes a verified key-ingredient claim from a complete formula review.

## Published states

- **Key ingredients** means the named ingredient and any shown concentration were checked against an official brand page.
- **Review pending** means JeloCare has not published a verified formula mapping for that product.
- Product packaging remains the final formula reference because brands can change formulas by market or over time.

Retailer copy and product-name inference are not accepted as formula sources. Source URLs, verification dates, positions and concentrations are stored on `product_ingredients`. Pharmacist review is a separate field and is never set by the catalogue seed.

## Launch coverage

The first source-checked mappings cover Anua Niacinamide 10% + TXA 4%, CeraVe Blemish Control Cleanser, CeraVe Foaming Facial Cleanser, COSRX Snail 96 Essence, Nizoral A-D, PanOxyl 10% Foaming Wash and The Ordinary Azelaic Acid 10%.

Verified active IDs feed the deterministic clinical filter. Unmapped products continue to use conservative text detection, never a fabricated ingredient list.
