# Product image workflow

Updated: 2026-07-22

Product imagery is approved one exact SKU at a time. Speed and catalogue size never lower the visual bar.

This is the complete target workflow for new intake. The current legacy static subset has source and art display reviews but no encoded reuse licence; `data/product-display-approvals.ts` records that limitation as `rightsStatus: not-verified`. Display approval must never be described as permission.

## 1. Lock the product first

Do not make an image for a loose product name. The intake record must identify the exact brand, line, formula or version, active strength where relevant, size, pack count, package type, market and GTIN when available.

Collect an identity set before art begins:

- official manufacturer product page;
- clear front, side and back pack references;
- exact Nigerian listing and current availability evidence;
- NAFDAC status or an explicit unresolved regulatory hold;
- image owner, licence or written permission;
- source retrieval time and content hashes.

An unresolved identity, rights or regulatory field keeps the product private.

## 2. Choose one visual route

### Licensed photography

Use an owned, licensed or explicitly permitted original photograph when it already meets the art direction. Preserve the photograph; crop and colour correction must not change the pack.

### Transparent source-pixel packshot

An official or licensed package image may be isolated onto a transparent canvas when the process preserves the source package pixels. The final asset must be centred, retain the full pack, and have a clean alpha edge on peach, pink, and dark review surfaces. Remove studio rectangles, matte spill, chroma fringe, and broad feathering without redrawing the label, material, colour, geometry, claims, or size. Record the identity master, transformation, hash, colour profile, and source comparison.

### Styled composite

An exact, source-verified package may be separated from its background and placed into a photographed or generated set. The isolated package remains identity evidence; the surrounding scene may add atmosphere but cannot change the product.

The final composite must preserve the package silhouette, label, spelling, claims, colour, variant, size and cap or pump. Add realistic contact shadow, reflected light and surface interaction so the result reads as photography rather than a floating cutout.

### Generated editorial scene

Generation may create surfaces, props, light, atmosphere and people-led editorial imagery. It must not invent a branded package or silently redraw product text. If a model alters any package detail, discard the result.

## 3. JeloCare art direction

- Editorial beauty still life, not marketplace catalogue photography.
- Peach, blush, pink, soft coral, cream and occasional cool contrast; avoid a brown monochrome field.
- Soft directional light with believable shadow and depth.
- One clear hero product. Props are sparse and relevant to texture or use.
- Complete packaging remains visible. Do not clip the cap, pump, base or important label text.
- Keep the product recognisable at card size and readable in the detail hero.
- Do not place copy over uncontrolled image detail.
- No checkerboard, white halo, jagged mask, detached label art, floating cap, retained hand or accidental background fragment.
- People-led imagery may support the story, but never imply that a person uses or endorses a product without permission.

## 4. Master and derivatives

Keep a non-destructive master and generate derivatives from it.

- Master: sRGB, at least 1,600 px on the short edge.
- Primary card/detail crop: 4:5 or square according to the existing component.
- Preserve safe space for responsive crops.
- Export modern web formats with an appropriate fallback.
- Record dimensions, MIME type, byte size, SHA-256 and crop relationship.
- Store a source preview beside the final preview for review; never expose working files publicly.

## 5. Two-review gate

### Identity review

Compare the final image against the identity set at full resolution. Confirm the exact brand, product, formula/version, strength, size, packaging and visible claims. Confirm source rights and bind the approval to the final asset hash.

### Art review

Confirm that the final image is magazine-ready at desktop and mobile sizes: clean composition, intentional colour, realistic light, complete package, strong card-scale recognition and no extraction or generation artefacts.

Both reviews are required. A score cannot override either gate. `data/product-display-approvals.ts` binds the approved brand, name, size, source URL, final bytes, source reviewer, art reviewer, and review times; changing any identity or image field keeps the file private until both checks are repeated.

## 6. Release rule

Preview the approved asset in the real home rail, inventory card and product hero before release. Publish only after responsive browser review and remote-byte verification. If the image or product record changes, both approvals expire.

Raw bulk imports, unreviewed automated extractions and generated drafts remain private research assets. A polished source-pixel isolation may publish only after the identity, edge, colour-profile, responsive, and remote-byte checks above.
