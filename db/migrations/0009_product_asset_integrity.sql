begin;

alter table product_images
  add column if not exists has_alpha boolean,
  add column if not exists content_hash text
    check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');

create index if not exists product_images_content_hash_idx
  on product_images (content_hash)
  where content_hash is not null;

commit;
