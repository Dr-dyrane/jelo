begin;

insert into retailers (slug, name, trust_score)
values
  ('teeka4', 'Teeka4', 98),
  ('lux-beauty', 'Lux Beauty', 96),
  ('beauty-by-daz', 'Beauty by Daz', 100),
  ('perona-beauty', 'Perona Beauty', 86),
  ('agt-plaza', 'AGT Plaza', 78),
  ('lush-hair-nigeria', 'Lush Hair Nigeria', 98),
  ('jumia', 'Jumia', 62)
on conflict (slug) do update set
  name = excluded.name,
  trust_score = excluded.trust_score;

delete from offers offer_to_remove
using products product, retailers retailer
where offer_to_remove.product_id = product.id
  and offer_to_remove.retailer_id = retailer.id
  and product.slug = 'kuza-indian-hemp-hair-scalp-treatment'
  and retailer.slug = 'perfect-picture-cosmetics'
  and offer_to_remove.market_code = 'NG'
  and exists (
    select 1
    from offers existing_offer
    where existing_offer.product_id = offer_to_remove.product_id
      and existing_offer.retailer_id = offer_to_remove.retailer_id
      and existing_offer.market_code = 'GH'
  );

update offers offer_to_update
set
  market_code = 'GH',
  updated_at = now()
from products product, retailers retailer
where offer_to_update.product_id = product.id
  and offer_to_update.retailer_id = retailer.id
  and product.slug = 'kuza-indian-hemp-hair-scalp-treatment'
  and retailer.slug = 'perfect-picture-cosmetics'
  and offer_to_update.market_code = 'NG';

update retailers
set
  slug = 'choices-beauty',
  name = 'Choices Beauty'
where slug = 'choices-chi'
  and not exists (
    select 1
    from retailers existing_retailer
    where existing_retailer.slug = 'choices-beauty'
      or existing_retailer.name = 'Choices Beauty'
  );

with verified_offer (
  product_slug,
  retailer_slug,
  url,
  available,
  price_ngn,
  checked_at
) as (
  values
    (
      'some-by-mi-aha-bha-pha-miracle-toner',
      'teeka4',
      'https://teeka4.com/shop/somebymi-aha-bha-pha-30days-miracle-toner-150ml-5oz/',
      false,
      13495::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'face-facts-bright-clear-face-cream',
      'beauty-by-daz',
      'https://beautybydaz.com/shop/face/treatment/face-facts-bright-clear-face-cream-75ml/',
      true,
      7500::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'face-facts-bright-clear-face-cream',
      'perona-beauty',
      'https://peronabeauty.com/product/face-facts-bright-clear-face-cream-75ml/',
      true,
      7750::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'b-lab-matcha-hydrating-real-sunscreen',
      'beauty-by-daz',
      'https://beautybydaz.com/shop/face/sunscreens/b-lab-matcha-hydrating-real-sun-screen-spf50-pa/',
      true,
      9000::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'miracle-natural-hair-anti-dandruff-shampoo',
      'agt-plaza',
      'https://www.agtplaza.com/products/miracle-shampoo-natural-hair-anti-dandruff-anti-itch-with-castor-oil-400ml-ugm41a',
      true,
      1695::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'lush-hair-mentholated-conditioner',
      'lush-hair-nigeria',
      'https://nigeria.lushhairafrica.com/products/mentholated-conditioner-370ml',
      true,
      1687::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'disaar-argan-oil-body-oil-gel',
      'jumia',
      'https://www.jumia.com.ng/disaar-argan-oil-body-oil-gel-deep-moisturizing-skin-care-200ml-419220900.html',
      true,
      4500::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'anua-niacinamide-10-txa-4-serum',
      'jumia',
      'https://www.jumia.com.ng/anua-niacinamide-10-txa-4-serum-30ml-new-version-419517907.html',
      true,
      7999::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'mediana-leave-in-conditioning-milk',
      'jumia',
      'https://www.jumia.com.ng/mediana-leave-in-conditioning-milk-250ml-215118251.html',
      true,
      2084::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'la-roche-posay-anthelios-uvmune-400-oil-control-fluid',
      'teeka4',
      'https://teeka4.com/shop/la-roche-posay-anthelios-uvmune-400-oil-control-fluid-spf50for-oily-blemish-prone-skin-50ml-1-7oz/',
      false,
      23500::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'cosrx-advanced-snail-96-mucin-power-essence',
      'beauty-by-daz',
      'https://beautybydaz.com/shop/face/treatment/cosrx-advanced-snail-96-mucin-power-essence/',
      false,
      12500::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'cosrx-advanced-snail-96-mucin-power-essence',
      'lux-beauty',
      'https://www.luxbeautyng.com/product/cosrx-snail-mucin-96-power-repairing-essence/',
      true,
      12400::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    ),
    (
      'panoxyl-acne-foaming-wash-10-benzoyl-peroxide',
      'teeka4',
      'https://teeka4.com/shop/panoxyl-acne-foaming-wash-benzoyl-peroxide-10-maximum-strength-without-pack/',
      false,
      13300::bigint,
      '2026-07-21T12:00:00Z'::timestamptz
    )
), saved_offer as (
  insert into offers (
    product_id,
    retailer_id,
    url,
    market_code,
    available,
    price_minor,
    currency_code,
    checked_at,
    inventory_status,
    verification_method,
    verification_note,
    last_verified_at,
    verification_expires_at,
    match_kind,
    extraction_confidence,
    extraction_evidence,
    extraction_adapter,
    canonical_url
  )
  select
    product.id,
    retailer.id,
    verified_offer.url,
    'NG',
    verified_offer.available,
    verified_offer.price_ngn,
    'NGN',
    verified_offer.checked_at,
    case
      when verified_offer.available then 'in_stock'::inventory_status
      else 'out_of_stock'::inventory_status
    end,
    'retailer_page'::verification_method,
    'Verified from the exact retailer product page.',
    verified_offer.checked_at,
    verified_offer.checked_at + interval '7 days',
    'exact',
    100,
    jsonb_build_array('price', 'stock', 'product_match'),
    'manual_exact_page',
    verified_offer.url
  from verified_offer
  join products product on product.slug = verified_offer.product_slug
  join retailers retailer on retailer.slug = verified_offer.retailer_slug
  on conflict (product_id, retailer_id, market_code) do update set
    url = excluded.url,
    available = excluded.available,
    price_minor = excluded.price_minor,
    currency_code = excluded.currency_code,
    checked_at = excluded.checked_at,
    inventory_status = excluded.inventory_status,
    verification_method = excluded.verification_method,
    verification_note = excluded.verification_note,
    last_verified_at = excluded.last_verified_at,
    verification_expires_at = excluded.verification_expires_at,
    match_kind = excluded.match_kind,
    extraction_confidence = excluded.extraction_confidence,
    extraction_evidence = excluded.extraction_evidence,
    extraction_adapter = excluded.extraction_adapter,
    canonical_url = excluded.canonical_url,
    updated_at = now()
  returning id, price_minor, currency_code, checked_at
)
insert into offer_price_history (
  offer_id,
  price_minor,
  currency_code,
  observed_at,
  source
)
select
  saved_offer.id,
  saved_offer.price_minor,
  saved_offer.currency_code,
  saved_offer.checked_at,
  'retailer_page'::verification_method
from saved_offer
on conflict do nothing;

commit;
