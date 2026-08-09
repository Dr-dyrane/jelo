# Ingredient review

JeloCare distinguishes a verified key-ingredient claim from a complete formula review.

## Published states

- **Key ingredients** means the named ingredient and any shown concentration were checked against an official brand page.
- **Review pending** means JeloCare has not published a verified formula mapping for that product.
- Product packaging remains the final formula reference because brands can change formulas by market or over time.

Retailer copy and product-name inference are not accepted as formula sources. Source URLs, verification dates, positions and concentrations are stored on `product_ingredients`. Pharmacist review is a separate field and is never set by the catalogue seed.

## Public library projection

The public ingredient library is built from two independent inputs: the current canonical public catalogue and the reviewed product-ingredient evidence. The route fetches the catalogue first, then joins evidence to products by exact canonical slug. Evidence for a private, withdrawn or otherwise unpublished product cannot survive that join and therefore cannot create a public ingredient card.

Each published ingredient card may show only products that survive the canonical join. It carries the retained official formula source, the latest verification date and any reviewed concentration. A catalogue title, retailer description or concern label must never create an ingredient relationship. Adding a product to the catalogue does not add its ingredients; a separate source-checked ingredient record is required.

This boundary is enforced by `lib/clinical/ingredient-library.ts` and `modules/clinical/ingredient-library.test.ts`. The test removes a known public product from the catalogue input and proves that its ingredient-only card also disappears.

## Launch coverage

The first source-checked mappings cover Anua Niacinamide 10% + TXA 4%, CeraVe Blemish Control Cleanser, CeraVe Foaming Facial Cleanser, COSRX Snail 96 Essence, Nizoral A-D, PanOxyl 10% Foaming Wash and The Ordinary Azelaic Acid 10%. A reviewed mapping alone does not guarantee public display: for example, the Nizoral mapping remains absent from the public library while that exact product is not in the canonical public catalogue.

Verified active IDs feed the deterministic clinical filter. Products without an explicit care review and verified ingredient evidence remain ineligible for direct guidance; catalogue names, concerns, retailer copy and other free text never supply formula evidence.
