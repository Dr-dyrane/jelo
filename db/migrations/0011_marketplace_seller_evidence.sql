begin;

alter table offers
  add column if not exists seller_name text,
  add column if not exists seller_score smallint,
  add column if not exists official_store boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'offers_seller_score_check'
  ) then
    alter table offers
      add constraint offers_seller_score_check
      check (seller_score is null or seller_score between 0 and 100);
  end if;
end
$$;

update offers offer
set
  seller_name = seller.name,
  seller_score = seller.score,
  inventory_quantity = seller.quantity,
  official_store = false,
  updated_at = now()
from products product, retailers retailer, (
  values
    ('anua-niacinamide-10-txa-4-serum', 'jumia', 'Smile Time', 92::smallint, null::integer),
    ('mediana-leave-in-conditioning-milk', 'jumia', 'Jeto', 88::smallint, 6::integer)
) as seller(product_slug, retailer_slug, name, score, quantity)
where offer.product_id = product.id
  and offer.retailer_id = retailer.id
  and product.slug = seller.product_slug
  and retailer.slug = seller.retailer_slug
  and offer.market_code = 'NG';

commit;
