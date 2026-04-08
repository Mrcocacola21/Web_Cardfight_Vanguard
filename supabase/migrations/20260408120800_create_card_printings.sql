create table catalog.card_printings (
  id uuid primary key default gen_random_uuid(),
  printing_key text not null unique,
  card_entity_id uuid not null
    references catalog.card_entities (id)
    on delete restrict,
  product_id uuid not null
    references catalog.products (id)
    on delete restrict,
  collector_number text not null,
  rarity text not null,
  locale_code text not null,
  region_code text null,
  printed_name text null,
  art_variant text null,
  is_alternate_art boolean not null default false,
  is_promo_variant boolean not null default false,
  unique (product_id, collector_number, locale_code)
);

create index card_printings_card_entity_idx
  on catalog.card_printings (card_entity_id);

create index card_printings_product_idx
  on catalog.card_printings (product_id);
