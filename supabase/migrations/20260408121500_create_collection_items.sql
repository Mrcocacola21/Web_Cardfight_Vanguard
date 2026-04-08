create table user_data.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null
    references user_data.collections (id)
    on delete cascade,
  card_printing_id uuid not null
    references catalog.card_printings (id)
    on delete restrict,
  quantity integer not null check (quantity > 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, card_printing_id)
);

create index collection_items_printing_idx
  on user_data.collection_items (card_printing_id);
