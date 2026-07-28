# DANG Hydra Glow Nigeria-offer blocker

**Reviewed:** 2026-07-28
**Candidate:** `dang-hydra-glow-sun-protection-gel-60ml`
**Decision:** Keep the candidate at the Nigeria-offer gate.

## What is already proved

The retained official DANG response binds one exact product to:

- manufacturer SKU `DGL-SKC-051`;
- `Hydra Glow Sun Protection Gel-60ml`;
- `60 ml`;
- the current turquoise carton and inverted turquoise tube; and
- an explicitly null manufacturer barcode.

The checked-in 2,000 px transparent packshot is derived from the same reviewed
official package asset. Its identity, variant, size and package presentation are
not the blocker.

## Why the retained offers cannot be promoted

### Bracketts Beauty

The retained observation supports a Nigerian offer, `60 ml`, price and stock,
and it names its own retailer SKU. Its title is only `Hydra Glow Sun
Protection`, however. It omits both `Gel` and the measured size from the title,
and the retained exact-offer fields do not bind that shortened title to the
official exact variant.

The listing also names the brand as `Dang!`, while the retained official product
record names the manufacturer/vendor as `Dang Lifestyle` and contains no
separate reviewed brand-alias field. The current listing image visually matches
the official turquoise tube, but a visual match cannot invent the missing
official alias or turn the retailer SKU into manufacturer SKU
`DGL-SKC-051`.

### BuyBetter

The retained title does contain `DANG -Hydra Glow Sun Protection Gel-60ml`, so
its variant and measured size are specific. Its current product image also
visually matches the reviewed official carton-and-tube package.

The retained response has an empty structured brand/vendor field, though. The
word `DANG` appears only inside the product title and category. Under the
manufacturer-SKU route, that is not an explicit brand field. The listing's SKU
`69167` is BuyBetter's internal retailer identifier, not manufacturer SKU
`DGL-SKC-051`. The retained observation is also out of stock.

## Evidence-bound conclusion

Neither observation satisfies the complete
`official-manufacturer-sku-and-exact-variant-size-package` offer binding:

- the Jul 26 response hashes are referenced by the candidate, but their raw
  response bytes are not checked in as canonical offer snapshots;
- neither excluded observation has a retained `offerRecord`;
- Bracketts lacks the exact official variant title and a reviewed official
  `Dang!` alias; and
- BuyBetter lacks an explicit brand/vendor field.

Adding only `observedGtinBasis: exact-variant-and-size` and
`observedPackageVersion` would therefore make the record look complete without
proving its identity. The candidate must remain private.

## Smallest truthful ways forward

Any one of these can unlock a fresh offer without weakening the route:

1. a current reviewed Nigerian response that explicitly names `Dang Lifestyle`
   (or an independently retained official brand alias), the exact 60 ml variant,
   and the current package;
2. a brand-authorized Nigerian offer whose exact product record is correlated
   to manufacturer SKU `DGL-SKC-051`; or
3. an official manufacturer GTIN for this exact 60 ml package followed by a
   current retailer response that exposes the same valid GTIN.

Until then, keep Bracketts and BuyBetter in `excludedObservations` and do not
publish their prices as exact comparable offers.
