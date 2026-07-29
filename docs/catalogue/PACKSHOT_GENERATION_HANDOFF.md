# Exact-SKU packshot generation handoff

Updated: 2026-07-28

## Purpose

`data/catalogue-packshot-generation-specifications.json` is a private production
brief for exact-SKU image work. It is not a generation record, rights decision,
art review, publication dossier or release.

The verifier intentionally accepts only candidates that remain at the
fail-closed `rights` stage. If output, rights, review, dossier or release claims
appear before this plan is removed or replaced by the completed evidence, the
plan fails.

## Current cohort

There are no open generation briefs. A product appears in
`data/catalogue-packshot-generation-specifications.json` only while its exact
image work remains unresolved.

The 26 July cohort is complete:

| Candidate | Exact identity | Final image basis |
| --- | --- | --- |
| NIVEA Perfect & Radiant Body Lotion 400 ml | GTIN `4005900378606` | Official transparent NIVEA media, normalized to the publication canvas and reviewed on peach, pink and dark |
| Simple Kind to Skin Refreshing Facial Gel Wash 150 ml | GTIN `5011451103863` | Identity-verified render with a tamper-evident generation record and multi-surface review |
| DANG Azelaic Acid Serum 30 ml | GTIN `6154000333867` | Bottle-only identity-verified render with a tamper-evident generation record and multi-surface review |

NAFDAC context does not block these records. Prices remain dated exact
observations and do not establish seller authenticity.

## Decide whether generation is needed

Do not generate by default. First look for a full-resolution, exact-SKU asset
from the manufacturer or another source with documented reuse rights. It may
pass without generation when the package is exact, the complete product is
visible, the final background and edges pass, and the retained source and
public bytes satisfy the publication gate.

Generation is appropriate only when exact identity and source bytes are already
locked but the permitted source cannot provide the faithful, complete,
publication-grade transparent packshot. A visually similar variant, different
size, retailer thumbnail, marketplace collage, screenshot, or watermarked
image is not an input substitute. If no exact source exists, keep the image
sublane blocked rather than asking a model to invent it.

## Author a clean image-tool prompt

The code operator owns the brief even when another operator owns generation.
Create one entry in
`data/catalogue-packshot-generation-specifications.json` that conforms to
`CataloguePackshotGenerationSpecification` in
`lib/catalogue/packshot-generation-specification.ts`. Bind the current
candidate, official identity snapshot, and immutable source URL, hash, type,
bytes, dimensions, and retrieval time before writing the request.

Use this structure for `request.prompt`, replacing every bracketed value with
facts visible in the exact source:

```text
Use case: precise-object-edit
Asset type: JeloCare exact-SKU catalogue packshot
Primary request: Use Image 1 as the only identity reference and edit target.
Create a pristine, high-resolution, front-facing packshot of the exact
[EXACT VARIANT] [EXACT SIZE]. Preserve the package geometry, materials,
closures, label hierarchy, colours, claims, and printed size exactly as shown.
Required visible details: [LIST AT LEAST FIVE SOURCE-VISIBLE DETAILS].
Scene/backdrop: a perfectly flat solid #ff00ff working background for removal;
no floor plane, gradient, texture, reflection, contact shadow, or props.
Composition: upright, centred, fully visible, generous even padding, and no
clipping.
Constraints: do not redesign the package; do not add, remove, translate, or
rewrite label text; do not change the variant or size; do not invent a carton,
barcode, GTIN, seal, cap, pump, dropper, ingredient, claim, or certification;
do not add a watermark.
```

Keep `requiredVisibleDetails` and `prohibitedChanges` as separate, concrete
arrays in the specification as well. Each needs at least five entries. The
visible-detail list must name the exact printed size; the prohibited list must
explicitly protect the barcode or GTIN. The prompt must name `Image 1`, the
exact variant, exact size, `#ff00ff`, and `no clipping`; the verifier rejects a
brief that omits any of them.

If the current agent cannot call an image tool, its deliverable is the verified
specification—not a simulated image. Report the candidate ID, bound source,
prompt, and verification result so an image-capable operator can execute it
without repeating research. Do not create SVG/CSS approximations or claim
future provider, model, timestamps, or hashes.

## Run a future handoff

1. Open the matching specification and use its immutable source URL and SHA-256
   as the only image input.
2. Give the image tool the full prompt unchanged. Do not simplify product text,
   substitute a similar package or infer missing package details.
3. Save the raw output outside the public catalogue. Record the actual provider,
   model, prompt, source URL and source SHA-256, output SHA-256 and generation
   time. Never pre-fill these values.
4. Remove the flat `#ff00ff` working background locally. Do not remove or alter
   product pixels, label text, size, geometry, cap, pump or dropper.
5. Inspect the decoded final image. It must be a genuine transparent PNG, 2000 ×
   2000, centred, intact and free of clipping, fringe, shadows, white canvas or
   hidden photo planes.
6. Upload to a new content-addressed JeloCare-controlled path with overwrite
   disabled. Recompute the uploaded response hash, MIME type, byte size and
   decoded dimensions.
7. Compare source and output side by side at full resolution, then inspect the
   output on peach, pink and dark surfaces. A reviewer records the result only
   after this comparison.
8. Add the completed generation record and final asset fields to the per-SKU
   intake source. Rebuild and verify the intake projection before drafting a
   dossier or release.

## DANG safety rule

The earlier DANG render that altered the carton barcode remains rejected
evidence. It must not be used as an input, uploaded, referenced or
rehabilitated.

The current brief requests the exact bottle only. The carton is identity
reference and must not appear in the output. If a generated result includes a
carton, barcode, invented digits, changed label text or a different bottle, reject
the result and generate again.

## Required verification

```bash
npx tsx scripts/verify-catalogue-packshot-generation-specifications.ts
npx tsx --test modules/catalogue/packshot-generation-specification.test.ts
npm run catalogue:intake:verify
npm run catalogue:intake:audit
```

After completed image evidence is added and its open plan is retired:

```bash
npm run catalogue:publication:verify
npm run catalogue:publication:releases:verify
npm run catalogue:publication:images:verify
```

The networked image verifier does not replace human identity or presentation
review. A passing image also does not publish a product by itself.
