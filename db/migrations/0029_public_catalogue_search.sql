begin;

create extension if not exists pg_trgm;
create extension if not exists unaccent;

alter table products
  add column approved_gtin text,
  add column search_text text not null default '';

alter table products
  add constraint products_approved_gtin_format_check
    check (approved_gtin is null or approved_gtin ~ '^[0-9]{8,14}$');

update products as product
set search_text = trim(
  regexp_replace(
    replace(
      replace(
        lower(
          unaccent(
            concat_ws(
              ' ',
              brand.name,
              product.name,
              product.size,
              product.approved_gtin,
              product.slug
            )
          )
        ),
        '''',
        ''
      ),
      '’',
      ''
    ),
    '[^a-z0-9]+',
    ' ',
    'g'
  )
)
from brands as brand
where brand.id = product.brand_id;

alter table products
  add constraint products_search_text_not_empty_check
    check (search_text <> ''),
  alter column search_text drop default;

create unique index products_approved_gtin_unique_idx
  on products (approved_gtin)
  where approved_gtin is not null;

create index products_public_search_trgm_idx
  on products using gin (search_text gin_trgm_ops)
  where is_published = true;

commit;
