# Catalogue troubleshooting — errors and fixes

Updated: 2026-08-06

A running log of errors encountered during catalogue intake, release, offer
binding, and market trends work. Each entry documents the symptom, root cause,
and fix so the same debugging path is not repeated.

## Intake and publication gate errors

### `New catalogue intake candidates require a packet-bound origin`

**Symptom:** Intake compile fails because the candidate's origin is
`legacy-deliberate-intake` instead of `community-aggregate-packet`.

**Root cause:** New candidates (order > legacy migration cohort) must use the
packet-bound origin, not the legacy origin. The legacy origin is only for the
fixed historical cohort.

**Fix:** Set `origin.kind` to `community-aggregate-packet` and generate a
valid 24-hex-char `packetId`. The `reportSha256` must also be set. See
`lib/catalogue/intake-source.ts` for the schema.

### `Catalogue intake must retain the fixed N-record legacy migration cohort`

**Symptom:** Intake compile fails because `catalogueIntakeLegacyMigrationCount`
does not match the actual number of legacy candidates.

**Root cause:** The constant in `lib/catalogue/intake-source.ts` must equal the
count of candidates with `origin.kind === 'legacy-deliberate-intake'`. Adding a
new candidate with a legacy origin increments the count; adding one with a
packet origin does not.

**Fix:** Update `catalogueIntakeLegacyMigrationCount` in
`lib/catalogue/intake-source.ts` AND the corresponding test fixture in
`modules/catalogue/intake-source.test.ts`. Both the constant and the test
expectation must agree.

### `identity evidence bytes do not match its canonical extraction`

**Symptom:** Intake compile fails because the identity evidence file's
`snapshotSha256` and `snapshotByteSize` do not match the canonical stable-JSON
form of the evidence object.

**Root cause:** The evidence file is pretty-printed or has keys in a different
order than the canonical `stableJson` + `\n` serialization. The hash and byte
size are computed over the canonical form, not the file as written.

**Fix:** Compute `JSON.stringify(evidence, sortedKeys) + '\n'` to get the
canonical form. The `snapshotSha256` is the SHA-256 of that string, and
`snapshotByteSize` is its UTF-8 byte length. Update the candidate file with the
correct hash and byte size. Do NOT manually format the JSON — the canonical
form is compact with sorted keys.

### `care-independent-guidance-missing`

**Symptom:** Intake compile fails because the care review's
`independentClinicalGuidanceUrl` is not in the approved list.

**Root cause:** The URL must be in `reviewedIndependentClinicalGuidanceUrls`
in `lib/catalogue/intake-readiness.ts`. Using a related-but-unapproved URL
(e.g. a different AAD page) fails the gate.

**Fix:** Pick a URL from the approved list. If the clinically correct URL is
not in the list, add it to `reviewedIndependentClinicalGuidanceUrls` first,
then reference it in the care review.

### `identity-official-evidence-invalid`

**Symptom:** Intake compile fails because the `size` field's `sourceText` does
not contain a recognizable measurement token.

**Root cause:** The `measurementTokens` matcher in the identity evidence
validator requires the source text to contain the unit (e.g. "400 ml", not
just "400 MLT"). The UN/CEFACT unit code (e.g. "MLT") alone is not
recognized — the human-readable unit must be present.

**Fix:** Update the `sourceText` for the size field to include the
human-readable measurement (e.g. "Volume: 400 ml" instead of "Volume: 400
MLT"). The value field stays as "400 ml".

### `asset-isolation-record-missing`

**Symptom:** Intake compile fails because the packshot isolation record's GTIN
does not match the candidate's GTIN.

**Root cause:** The isolation record in `data/catalogue-packshot-isolations.json`
must use the canonical 14-digit GTIN format (zero-padded). A 13-digit GTIN
(e.g. `3337872411991`) will not match the 14-digit canonical form
(`03337872411991`).

**Fix:** Zero-pad the GTIN to 14 digits in the isolation record. The canonical
form is `canonicalGtin(value)` which left-pads with zeros to 14 characters.

### `Face has no approved public catalogue category mapping`

**Symptom:** Release dry run fails because the candidate's category is not in
the approved category mappings.

**Root cause:** The `category` field in the candidate must match an approved
mapping in the category mapping registry. "Face" is not an approved category;
"Face care" is.

**Fix:** Change the candidate's `category` to an approved value (e.g. "Face
care"). The `--category` CLI option for the release script can remain
different — it controls the release metadata, not the intake category.

### `Staged asset promotion ID is invalid`

**Symptom:** Tests fail because the asset promotion record's schema does not
match the expected shape.

**Root cause:** The asset promotion record in
`data/product-asset-promotions.json` must follow the exact schema expected by
the validator — including the correct `id` format, `active` flag, `blobUrl`,
`contentHash`, and `stagedAt` fields.

**Fix:** Check an existing passing promotion record for the exact schema. The
`id` must be a valid content hash, not an arbitrary string.

## Offer freshness and market trends errors

### Market trends shows 51 of 83 products

**Symptom:** The market trends summary `productCount` shows 51 instead of 83.

**Root cause:** `getMarketTrendsReadModel` in `lib/share/market-trends.ts`
filtered to `shareableProducts` (products with fresh comparable NG offers)
before passing to `buildMarketTrendsReadModel`, so the summary count only
reflected shareable products.

**Fix:** Pass `totalProductCount: products.length` as an option to
`buildMarketTrendsReadModel`. The summary reports the full catalogue size; the
trend sections (price drops, increases, out-of-stock) remain filtered to
shareable products for honesty.

### Offers are stale (freshness window exceeded)

**Symptom:** Products with NG offers are not shareable because
`isOfferFresh` returns false. `comparableMarketPrice` returns null, so
`hasShareableNgOffer` returns false.

**Root cause:** The `OFFER_FRESH_DAYS = 7` window in
`modules/commerce/offer-freshness.ts` rejects offers older than 7 days. Offers
in `data/retail-offers.ts` with `checkedAt: '2026-07-22'` become stale after
2026-07-29.

**Fix:** Re-verify stale offers via Playwright/curl subagents and update
`data/retail-offers.ts` with fresh `observedAt` timestamps and current prices.
Offers without an explicit `observedAt` use the default `checkedAt` constant at
the top of the file — update that constant too. Add `expiresAt` to offers that
should auto-expire.

### Offers in original product files lack timestamps entirely

**Symptom:** Products have NG offers but `isOfferFresh` returns false because
`observedAt` and `checkedAt` are both undefined.

**Root cause:** Offers defined directly in `data/products.ts` and
`data/expanded-products.ts` (not via `retail-offers.ts`) may not have
`checkedAt` or `priceObservation.observedAt` fields. Without a timestamp,
`isOfferFresh` returns false.

**Fix:** Add fresh offer entries for these products in
`data/retail-offers.ts`. The `mergeRetailOffers` function overrides original
product offers by retailer name, so adding a fresh entry in
`verifiedRetailOffers` for the same retailer replaces the stale original.

### Beauty by Daz offers blocked by core audit

**Symptom:** Adding a Beauty by Daz offer for a product causes
`beauty-by-daz-core-audit.test.ts` to fail with "must remain withheld".

**Root cause:** The audit file
`data/retailer-verification/beauty-by-daz-core-14.json` assigns each product a
`disposition`. Only products with `disposition: 'verified-exact-offer'` may
have Beauty by Daz offers in `verifiedRetailOffers`. Products marked
`withheld`, `not-found`, or other dispositions must NOT have Beauty by Daz
offers.

**Fix:** Do not add Beauty by Daz offers for products with a non-`verified`
disposition in the audit. Use other retailers (Perona, Teeka4, BuyBetter, etc.)
for those products instead.

### Retailer trust ordering violation

**Symptom:** `retailer-registry.test.ts` fails with "trust >= store.trust"
assertion.

**Root cause:** `nigeriaRetailers` in `data/retailers.ts` must be sorted in
descending trust order. Inserting a new retailer in the wrong position breaks
the ordering invariant.

**Fix:** Place new retailers at the correct position based on their trust
value. For example, trust 80 goes between the trust-82 group and the trust-78
group. Check `grep "trust:" data/retailers.ts` to find the right insertion
point.

### Test fixtures use stale `now` date

**Symptom:** After updating offer timestamps, tests fail because the test's
fixed `now` date is older than the new offer timestamps, causing
`isOfferFresh` to return false (offers appear to be in the future).

**Root cause:** Tests like `offer-evidence.test.ts` use a hardcoded `const now
= new Date('2026-07-22T12:00:00Z')`. When offers are updated to a newer date,
the test's `now` must move forward too.

**Fix:** Update the test's `now` to a date after the newest offer timestamp.
Also update all fixture dates in the test file that reference the old date
(observedAt, checkedAt, lastVerifiedAt, etc.) to the new date so they remain
fresh relative to the new `now`.

### Only 1 store showing on product page despite verifying 5

**Symptom:** Product page shows only 1 retailer offer even though 5 retailers
were verified and have live product pages.

**Root cause:** Only 1 offer was added to `verifiedRetailOffers` in
`data/retail-offers.ts`. The Playwright verification gathered all 5 retailer
URLs and prices, but only 1 was actually written to the offer file.

**Fix:** Add ALL verified retailer offers to `data/retail-offers.ts`, not just
the first one. If a retailer is not in the registry
(`data/retailers.ts`), add it first with the correct trust value and
descending-order position.

### Duplicate product slug in retail-offers.ts (TS1117)

**Symptom:** `tsc --noEmit` fails with `TS1117: An object literal cannot have
multiple properties with the same name` at lines in `data/retail-offers.ts`.

**Root cause:** `verifiedRetailOffers` is a single object literal. When batch-
adding offers, a product slug that already has an entry earlier in the file
gets a second block appended near the closing `};`. TypeScript rejects this
even if both blocks have valid `exactNg` calls.

**Fix:** Before inserting a new product block, grep for the slug:
`grep -n "'<slug>'" data/retail-offers.ts`. If it already exists, append the
new `exactNg` call inside the existing array instead of creating a new block.
When a Python script generates the insertion, filter the candidate list
against existing slugs first — do not rely on `catalogue-intake.json`'s
`exactOffers` array, which is the intake-time snapshot, not the live offer
source of truth.

### Intake exactOffers empty but product already has offers

**Symptom:** A gap-finding script reports a product as "no offers" because
`catalogue-intake.json` shows `exactOffers: []`, but the product page
actually displays retailer offers.

**Root cause:** `data/catalogue-intake.json` records the intake-time offer
snapshot. Offers added later via `data/retail-offers.ts` (the
`verifiedRetailOffers` map) are merged at runtime by `mergeRetailOffers` and
never written back to the intake JSON. The intake file is not the source of
truth for current offer coverage.

**Fix:** Check `data/retail-offers.ts` for the slug, not the intake JSON. Use
the regex `'<slug>':\s*\[\s*exactNg` to detect existing entries. Only products
absent from `retail-offers.ts` are genuinely offer-less.

## Playwright and retailer scraping notes

### Beauty by Daz JS redirect hijack

**Issue:** `beautybydaz.com` serves JS-injected redirects that hijack the
Playwright browser to unrelated domains (caretobeauty.com,
lushhairafrica.com). The `browser_navigate` tool follows these redirects,
making `browser_evaluate` return data from the wrong site.

**Workaround:** Use `curl` with a Chrome User-Agent to fetch the
server-rendered HTML directly. Extract price from `<meta
property="product:price:amount">` and stock from JSON-LD
`"availability"` schema.org value. Both sources agree on every product.

### Perona Beauty and Teeka4 403 to webfetch

**Issue:** `peronabeauty.com` and `teeka4.com` return HTTP 403 to the
`webfetch` tool's default User-Agent.

**Workaround:** Use `curl` with a standard Chrome User-Agent header:
`curl -sL -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" "<URL>"`

### Jumia Cloudflare blocking

**Issue:** `jumia.com.ng` blocks all curl/webfetch access with a Cloudflare
challenge (HTTP 403). Some Jumia listing URLs also redirect to other
retailers (e.g. Slique Beauty).

**Workaround:** Use the Playwright MCP browser for Jumia pages. If the listing
redirects to another retailer, capture the data from the redirected page and
note the redirect in the offer record.

### Playwright browser session conflicts

**Issue:** When running multiple parallel subagents that all use the
Playwright MCP browser, they share a single browser session. One subagent's
navigation can hijack another's `browser_evaluate` call, returning data from
the wrong page.

**Workaround:** Run Playwright-dependent subagents sequentially, or have each
subagent use `curl`/`webfetch` as a fallback when the browser returns data
from an unexpected domain.

### Care to Beauty is a JS-rendered SPA

**Issue:** `caretobeauty.com/ng/` search pages are fully JS-rendered. Static
HTML contains no product listings, so curl/webfetch cannot extract search
results.

**Workaround:** Use the Playwright MCP browser for Care to Beauty search
pages. Direct product URLs (not search pages) do return server-rendered HTML
with product data.
