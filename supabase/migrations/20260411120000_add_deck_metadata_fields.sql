alter table user_data.decks
  add column tags text[] not null default '{}',
  add column is_favorite boolean not null default false;
