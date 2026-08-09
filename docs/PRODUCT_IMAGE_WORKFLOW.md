# Product image workflow

Updated: 2026-08-09

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

### Operator-supplied PNG quick lane

For the founder or another contributor, the handoff is intentionally small:

- the PNG file;
- the exact product name or official product link;
- the image source and reuse basis;
- any note about the version or size if the package has several variants.

That is enough. The catalogue operator resolves or creates the candidate ID,
confirms the exact package against an official reference, checks transparency
and framing, computes the hashes, prepares the candidate metadata, uploads the
approved bytes and runs the publication gates. The person supplying the image
does not need to know Blob, Neon or catalogue-manifest commands.

An operator completing the intake must record:

- the exact intake candidate ID;
- the image source and reuse basis;
- the official product or package reference used to confirm identity.

If the PNG is already a complete, genuinely transparent official or licensed
packshot, preserve its pixels, store the reviewed local file under
`public/products/{brand}/{candidate-id}-transparent-v{n}.png`, and record its
source hash, final hash, dimensions, MIME type and retrieval time in the
candidate. Upload it only to a versioned, content-addressed product path.

If the PNG has a background, pass it through the reviewed source-pixel operator
below. If it was generated, retain the model, provider, full prompt, every input
URL and hash, output hash and generation time. Generation provenance does not
replace exact-package identity review or image rights.

There is intentionally no anonymous drag-and-drop production uploader. Today an
operator stages the reviewed file and metadata, then uses the server-only Blob
path (`npm run assets:import` or the active
`npm run assets:promote:staged` manifest flow). Production materializes approved
metadata into Neon; operators do not write public product-image rows by hand.
The upload remains private until the candidate, dossier, release and remote
image gates all pass:

```bash
npm run catalogue:intake:audit
npm run catalogue:publication:images:verify
npm run assets:verify
npm test
```

An authenticated Asset Manager may later make this a guided browser workflow.
It must reuse these same gates rather than create a second publication path.

### Licensed photography

Use an owned, licensed or explicitly permitted original photograph when it already meets the art direction. Preserve the photograph; crop and colour correction must not change the pack.

### Transparent source-pixel packshot

An official or licensed package image may be isolated onto a transparent canvas when the process preserves the source package pixels. The final asset must be centred, retain the full pack, and have a clean alpha edge on peach, pink, and dark review surfaces. Remove studio rectangles, matte spill, chroma fringe, and broad feathering without redrawing the label, material, colour, geometry, claims, or size. Record the identity master, transformation, hash, colour profile, and source comparison.

Create the isolated operator environment once, then prepare a single hash-locked intake source for private review:

```bash
python3.12 -m venv .cache/reviewed-packshot-venv
.cache/reviewed-packshot-venv/bin/python -m pip install \
  --require-hashes \
  -r scripts/requirements-packshots.lock.txt
.cache/reviewed-packshot-venv/bin/python -m pip check
npm run catalogue:packshot:prepare-reviewed -- \
  --candidate-id <exact-intake-id> \
  --source <downloaded-identity-master>
```

Foundational products already present in the reviewed catalogue use the same
operator and gates with the checked-in
`data/foundational-packshot-intake.json` source manifest:

```bash
npm run catalogue:packshot:prepare-reviewed -- \
  --candidate-id <foundational-product-slug> \
  --intake data/foundational-packshot-intake.json \
  --source <downloaded-identity-master>
```

The alternate manifest changes only where the exact product and source hash
are locked. It does not weaken the runtime, source-pixel, identity, art, rights,
remote-byte, or publication gates.

Approved foundational isolations are recorded in
`data/foundational-packshot-isolations.json`. Each record binds the official
identity source, source bytes, GTIN evidence, deterministic runtime and model,
private audit hash, final local bytes, and causally ordered identity and art
reviews. These legacy display records retain `rightsStatus: not-verified`; they
must never be represented as reuse permission.

Recreate that exact directory if it predates the current lock. Do not reuse the legacy `.cache/rembg-venv` or install unrelated packages into the reviewed operator environment.

The operator requires the dedicated hash-locked Python 3.12 CPU runtime. It reads at most 20 MB from the source once, then binds the hash check, image decode, inference input, and identity-master copy to that exact byte buffer. Pixel area is rejected from the decoded header before EXIF transpose or full decode. The model supplies only an alpha mask; package RGB data remains from the identity master. ONNX Runtime receives explicit `SessionOptions`: one intra-op thread, one inter-op thread, sequential execution, deterministic compute, and per-session thread pools. These settings are constructed and verified inside the operator, so direct Python execution and changes to `OMP_NUM_THREADS` wrappers cannot alter the audited contract. The 2,000 × 2,000 review master embeds sRGB and the audit records Python, platform, architecture, runtime-lock hash, dependency versions, model hash, CPU provider, and effective session options. Removed mask components and area are recorded; a meaningful loss is flagged for review and a loss above 5% stops the run.

Each attempt is written and reopened inside a temporary directory. Only a complete, hash-verified audit, identity master, PNG, and review sheet are renamed into an immutable versioned run; `latest.json` is then replaced atomically. A crash may leave a complete orphan run, but cannot pair new image bytes with an old audit. All output remains under `.cache/catalogue-reviewed-packshots/`; manual identity, edge, rights, market, and publication gates still apply. Run `npm run catalogue:packshot:tool:check` in the dedicated environment to exercise path, single-read byte binding, hash, MIME, dimensions, decompression limits, explicit inference threading, environment-wrapper independence, real source-pixel normalization, colour profile, component loss, audit binding, and atomic-pointer invariants. The end-to-end `process_source` test mocks only the model session and mask response; cleanup and normalization remain real.

The operator and its audit are private preparation only; neither is an approval or publication dossier. An isolation cannot become approval-ready or enter dossier generation until a checked-in typed isolation record binds the exact source hash, output hash, pipeline version, model hash, runtime contract, audit hash, and ordered reviewer chronology. That record must still pass the independent identity, rights, edge, colour-profile, responsive, market, and publication gates.

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

When an exact official packshot already has genuine transparency, preserve those bytes in `public/products/` and bind them in `data/product-asset-promotions.json`. Production promotes only active, locally hash-verified entries to their declared deterministic Blob paths. The promotion is a two-phase release: first upload and remotely verify the bytes; only a later checked-in manifest and display approval may expose them. A production upload never approves or publishes a product by itself.

Raw bulk imports, automated extraction output, generated drafts, and operator audits remain private research or preparation assets. A source-pixel isolation becomes eligible for approval and dossier generation only after its checked-in typed isolation record binds the full preparation provenance and reviewer chronology described above; publication still requires every release check.

### Corrected-media lock

A product, offer, care, brand, retailer, search, or projection update must not
change an already published image unless the task explicitly includes a new
media review. Never copy an older image field, dossier, promotion, or product
record from a structural exemplar over the current record.

Before any product-lane write, reopen the product's current public image and
active promotion. If media is outside the requested scope, preserve its URL,
content hash, byte size, dimensions, active promotion, final-image binding,
and display approval exactly. A projection rebuild must derive those current
bindings; it must not reconstruct them from an older commit or source record.

Every accepted correction must:

1. create a new immutable versioned asset instead of overwriting old bytes;
2. update the active promotion and every canonical image binding atomically;
3. repeat exact-SKU and peach, pink, and dark review;
4. add the accepted hash to `restoredPackshotCohort` in
   `modules/assets/asset-manifests.test.ts`; and
5. run that focused regression test before the product is committed.

That cohort is the fail-closed warning for all agents: a later data or product
batch that restores an older packshot must fail before release. Changing or
removing a protected hash is itself a media revision and requires the full
review above; making an unrelated test pass is never sufficient authority.
