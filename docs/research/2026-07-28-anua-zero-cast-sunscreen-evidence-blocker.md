# ANUA Zero-cast sunscreen — evidence blocker

This note is candidate-scoped research for discovery
`7f5e4463688a37e008b523ff`. It is not a catalogue candidate, approval, or
publication instruction.

## Honest identity finding

- Canonical visible name: **ANUA Zero-cast Moisturizing Finish Sunscreen**.
- Size: **50 ml**.
- The discovery title's “Finnish” is a retailer typo; it must not become the
  catalogue name.
- ANUA's current US Shopify product response binds the exact name to
  manufacturer SKU `AK131001` and barcode `8809640738838`.
- BuyBetter binds its Nigerian listing to retailer SKU `8809640739507`.
  Independent non-manufacturer listings also use `8809640739507` for a
  Korean/EU presentation, but no reviewed official ANUA response currently
  binds that code.
- ANUA Korea product `434` confirms the Korean product and provides official
  imagery, but its accessible product response does not expose a barcode.

The identity gate therefore fails closed. The evidence supports a regional
presentation conflict, not permission to substitute one GTIN for another.

## Current Nigerian observations

Checked 2026-07-28:

| Retailer | Exact listing | Price | Stock | Local code |
| --- | --- | ---: | --- | --- |
| BuyBetter | `ANUA Zero Cast Moisturizing Finnish Sunscreen 50ml` | ₦14,000 | 29 in stock | `8809640739507` |
| Teeka4 | `Anua Zero-cast Moisturizing Finish Sunscreen 50ml` | ₦14,200 | Out of stock | `TK-1545` |

The two listings are useful market observations, but they cannot resolve the
regional identity conflict.

## Care and safety readiness

Care review is supportable once identity is resolved:

- daily broad-spectrum SPF 50 sunscreen;
- apply liberally 15 minutes before sun exposure;
- reapply after 80 minutes of swimming or sweating, immediately after towel
  drying, and at least every two hours;
- external use only; avoid damaged skin and eyes; stop and seek medical advice
  if a rash occurs;
- sunscreen supports sun protection but does not diagnose or treat acne,
  pigmentation, or another condition, and should sit beside shade, clothing,
  hats, and sunglasses.

Official ANUA product copy and the US DailyMed label support those statements.
They do not establish that the Nigerian `8809640739507` presentation is the
same regulated package as the US `8809640738838` presentation.

## Image provenance

- Official ANUA Korea main asset:
  `https://cafe24img.poxo.com/anuaskincare/web/product/big/202506/ad75091442b09115c167164617dbc6bc.png`
  — PNG, 1000 × 1220, alpha, 185,855 bytes,
  SHA-256 `3e3d78f398e85b5229ccb2bfc15f3898fbc0241892d02c6e1c7699e16e3622e9`.
- Official ANUA US main asset:
  `https://cdn.shopify.com/s/files/1/0753/1429/9158/files/anua-us-sunscreen-zero-cast-moisturizing-finish-sunscreen-1244398149.jpg?v=1781507109`
  — JPEG, 2000 × 2000, 187,421 bytes,
  SHA-256 `514b01edbb3793baccbd3c78f71c5be67d9aacdb212a71809a88aad3918b0f02`.
- BuyBetter and Teeka4 use different retailer-hosted image bytes. Neither
  retailer asset has been promoted or treated as manufacturer-authorized.

The official Korea asset is the best provenance lead, but it remains blocked
from release until the Nigerian package presentation is bound to an official
manufacturer identity.

## Retained response checks

| Response | MIME type | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `https://anua.com/products/zero-cast-moisturizing-finish-sunscreen.js` | `text/javascript` | 9,496 | `9ca3e384dd8cd49786c04c084386df67458737cd19a1abfeacf164871bd9ebf4` |
| `https://anua.kr/product/제로캐스트-데일리-투명-수분-선크림/434/` | `text/html` | 245,816 | `37ad3502ba2fb0379b6dc5caeb715af44af87bccd6f45133734f974df3defc11` |
| `https://buybetter.ng/wp-json/wc/store/v1/products/383321` | `application/json` | 7,054 | `2c0d241928e72bf3ef68159872f2c065907cafcd082537fb80c2a8d002aa7f15` |
| `https://teeka4.com/shop/zero-cast-moisturizing-finish-sunscreen-50ml/` | `text/html` | 328,043 | `3f3e661e59c5ea8b1485536308cfac7e27dd2c2bafc5e1c3b2d174f1aa1218e5` |

These hashes record the reviewed responses at the time of this note; the full
responses were not added as release artifacts because the candidate is blocked.

## Release blockers

1. Official/current US barcode `8809640738838` conflicts with the Nigerian
   listing code `8809640739507`.
2. No official ANUA response has yet bound `8809640739507` to the exact
   50 ml Korean/EU package.
3. Discovery rank 36 has no retained research-evidence packet, so it cannot
   enter the packet-bound candidate lane without changing a shared generated
   projection.
4. Image promotion must wait for the exact Nigerian package identity.

Next smallest honest action: obtain an official ANUA package record or official
response that explicitly binds `8809640739507` to this 50 ml presentation,
then regenerate the shared research packet in its owning lane.
