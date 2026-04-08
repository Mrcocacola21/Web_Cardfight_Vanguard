create table catalog.products (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  family_id text not null
    references catalog.product_families (id)
    on delete restrict,
  official_code text not null,
  name text not null,
  product_category text not null check (
    product_category in ('booster', 'deck', 'promo', 'special-set')
  ),
  product_kind text not null,
  release_date date not null,
  region_code text null,
  cycle_key text null,
  check (
    (product_category = 'booster' and product_kind in ('main', 'extra', 'title', 'lyrical'))
    or (product_category = 'deck' and product_kind in ('trial', 'start'))
    or (product_category = 'promo' and product_kind in ('standalone', 'event', 'bundle', 'shop', 'other'))
    or (
      product_category = 'special-set'
      and product_kind in ('special-series', 'festival', 'collector', 'other')
    )
  )
);

create unique index products_family_code_region_idx
  on catalog.products (family_id, official_code, coalesce(region_code, ''));

create index products_release_date_idx
  on catalog.products (release_date desc);

create index products_taxonomy_idx
  on catalog.products (product_category, product_kind);
