create table catalog.keyword_tags (
  id text primary key,
  display_name text not null,
  category text not null check (
    category in ('keyword', 'mechanic', 'trigger', 'marker')
  ),
  description text null,
  sort_order integer not null default 0 check (sort_order >= 0)
);

create table catalog.card_entity_keyword_tags (
  card_entity_id uuid not null
    references catalog.card_entities (id)
    on delete cascade,
  keyword_tag_id text not null
    references catalog.keyword_tags (id)
    on delete restrict,
  applied_at timestamptz not null default timezone('utc', now()),
  primary key (card_entity_id, keyword_tag_id)
);

create index card_entity_keyword_tags_keyword_tag_id_idx
  on catalog.card_entity_keyword_tags (keyword_tag_id);
