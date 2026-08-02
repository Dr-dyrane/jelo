# Skin by Zaron salicylic toner — EAN resolution

This note resolves the conflicting retailer identifiers for discovery
`cd29efd703d9f5ad9192bf01`. It is candidate-scoped research, not a catalogue
approval or publication instruction.

## Resolution

- **Skin by Zaron 2% Salicylic Acid Toner, 150 ml:** EAN-13
  `6908137011460` (canonical GTIN-14 `06908137011460`).
- **Skin by Zaron Ultimate Glow Brightening Toner, 300 ml:** EAN-13
  `6908137011040` (canonical GTIN-14 `06908137011040`).

Both identifiers have valid GS1 check digits. They belong to different named
products and sizes; they are not competing identifiers for one package.
`6908137011040` must therefore never be substituted into the 150 ml salicylic
toner candidate.

## Evidence reviewed

The current official Zaron product route and product API bind the yellow pump
package to **2% Salicylic Acid**, but publish neither a GTIN nor a size:

- `https://www.zaroncosmetics.com/product/2-salicylic-acid`
- `https://zaron-api-v2-89a647693f92.herokuapp.com/api/product/2-salicylic-acid`

The 150 ml salicylic identity and EAN are independently consistent across:

- BuyBetter's exact Nigerian listing, which publishes the full 150 ml title
  and SKU `6908137011460`:
  `https://buybetter.ng/product/skin-by-zaron-salicylic-acid-2-clarifying-brightening-exfoliating-toner-150ml/`
- Baki's exact product page, which publishes `Zaron Salicylic Acid Toner
  150ml` and SKU `6908137011460`:
  `https://www.baki.co.ke/product/zaron-salicylic-acid-toner/`

The conflicting code is independently bound to the other package:

- BuyBetter publishes **Ultimate Glow Brightening Toner 300 ml** with SKU
  `6908137011040`:
  `https://buybetter.ng/product/skin-by-zaron-ultimate-glow-brightening-toner-300ml/`
- CSi Grocery publishes the same 300 ml product and code:
  `https://www.csigrocery.com/shop/skincare/face/toners/skin-by-zaron-ultimate-glow-brightening-toner/`

The repository's retained BuyBetter response for the salicylic toner remains
the market observation at
`data/catalogue-offer-source-evidence/cd29efd703d9f5ad9192bf01--buybetter.json`.

## Publication boundary

The EAN conflict is closed, but the release gate remains closed for two
separate reasons:

1. Zaron's official page, API response, and two official 800 × 1000 WebP
   images do not visibly bind the package to **150 ml**. Retailer agreement
   cannot be rewritten as manufacturer size evidence.
2. The official images are below the 1600 px catalogue source threshold. Once
   exact manufacturer size evidence is available, the packshot should use the
   image-generation handoff rather than silently promoting a low-resolution
   source.

Next smallest honest action: obtain an official Zaron product record or package
image that visibly binds the current yellow pump package to 150 ml. Then reuse
the resolved EAN above, capture two reviewed corroborators, complete care
review, and hand the official pack image to the normal generation workflow.
