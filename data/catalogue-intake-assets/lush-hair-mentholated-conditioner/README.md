# LUSH HAIR Mentholated Conditioner

Drop the official brand source image here as `source-official.jpg` (or `.png`).

Requirements:
- Must be the exact product: LUSH Hair Mentholated Conditioner, 370 ml
- Official source: https://nigeria.lushhairafrica.com/products/mentholated-conditioner-370ml
- Note: Official images are small (368x654 GIF, 600x778 PNG) — below 1600px minimum
- This means the generation route will be needed (or a higher-res source must be found)
- GTIN: NOT FOUND on official Shopify page (empty barcode field). GS1 prefix 6154000 confirmed for Lucky Fibres PLC but specific product GTIN not published.

Blocker: Missing GTIN. If you have the physical product barcode or can find the GTIN,
add it to the intake candidate after dropping the image.

After the image is dropped here, the agent will:
1. Compute SHA-256, dimensions, and MIME type
2. Add the candidate to data/catalogue-intake.json (with GTIN if available)
3. Run the packshot preparation or generation route
4. Review the transparent packshot output
