# Next community-priority SKU evidence

**Checked:** 2026-07-27
**Scope:** publication readiness for the two closest unreleased,
community-priority products
**Decision:** neither product is ready for public catalogue release

This is a research handoff, not publication evidence. URLs and observed facts
below still need immutable capture, hashing, directory review, and binding to a
candidate dossier through the catalogue publication workflow.

## DANG Hydra Glow Sun Protection Gel 60 ml

### Evidence found

- DANG's official Shopify response identifies **Hydra Glow Sun Protection Gel
  60 ml** and manufacturer SKU `DGL-SKC-051`:
  [official response](https://danglifestyle.co/products/hydra-glow-sun-protection-gel-60ml.js?country=NG&currency=NGN&v=2).
- The American Academy of Dermatology publishes independent sunscreen use
  guidance:
  [AAD sunscreen guidance](https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/how-to-apply-sunscreen).
- Bracketts Beauty exposed an exact Dang 60 ml offer at ₦25,000 and in stock
  during this check:
  [Bracketts listing](https://www.brackettsbeauty.com/products/hydra-glow-sun-protection).
- Beauty Hut Africa exposed an in-stock Dang listing at ₦26,900:
  [Beauty Hut listing](https://beautyhutafrica.com/product/dang-hydra-glow-sun-protection-gel/).
  Beauty Hut is not yet a reviewed JeloCare retailer and the page did not
  explicitly state 60 ml, so this is a retailer-review lead rather than a
  qualifying offer.
- BuyBetter exposed the exact named 60 ml item at ₦19,350 but marked it out of
  stock, and its structured product record had no brand:
  [BuyBetter listing](https://buybetter.ng/product/dang-hydra-glow-sun-protection-gel-60ml/).

### Remaining publication blockers

1. Bind a reviewed independent-care record after the existing official
   identity lock.
2. Capture and hash the Bracketts exact offer.
3. Establish a second current exact Nigerian offer from a reviewed independent
   retailer, or a qualifying brand-authorized offer.
4. Resolve the owned render's rights record and move it to the required
   immutable `/products/.../packshot-vN-<hash>.png` path.
5. Repeat art review after the final identity and evidence timestamps.

Marketplace listings and ambiguous availability do not close these gates.

## PREQUEL Gleanser + Glycolic Acid Cleanser 400 ml

### Evidence found

- PREQUEL's official page confirms the exact product, 400 ml, 50% glycerin and
  5% glycolic acid:
  [official product page](https://prequelskin.com/products/gleanser-glycerin-and-glycolic-acid-cleanser).
- The official page did not expose a GTIN or manufacturer SKU.
- Target independently corroborates UPC `810129110562` and 13.5 fl oz:
  [Target listing](https://www.target.com/p/-/A-94736817). Retailer
  corroboration does not replace official identifier evidence.
- Independent general cleansing guidance is available from the AAD:
  [AAD face-washing guidance](https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101).
- Two current exact Nigerian offer leads were observed:
  [BuyBetter at ₦37,088](https://buybetter.ng/product/prequel-gleanser-glycolic-acid-cleanser-400ml/)
  and
  [Nihet Beauty at ₦96,000](https://nihetbeauty.com/product/prequel-gleanser-glycolic-acid-cleanser-400ml/).

### Remaining publication blockers

1. Capture and approve an official exact-SKU identifier, or complete the
   repository's approved no-official-ID corroboration path.
2. Preserve or reconstruct the candidate's missing research-packet provenance
   before release.
3. Create or license a 1600 px or larger intact transparent packshot with
   complete source/rights records.
4. Complete manual art review after the final identity lock.

The extreme observed offer spread is not a public price trend until both
offers pass the exact-evidence gate and historical comparable observations
exist.

## Next actions

1. Finish DANG first because exact official identity and an owned render
   already exist.
2. Review Beauty Hut Africa as a retailer separately; retailer approval must
   not be inferred from one product page.
3. Preserve PREQUEL's two offer leads while resolving identity and image
   provenance.
4. Run the normal dry-run publication command only after every blocker is
   closed. Never bypass the dossier, image, or explicit-release gates.
