create table user_data.decks (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  format_id text not null
    references legality.formats (id)
    on delete restrict,
  title text not null,
  description text null,
  visibility text not null default 'private' check (
    visibility in ('private', 'unlisted', 'public')
  ),
  current_version_id uuid null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index decks_owner_idx
  on user_data.decks (owner_profile_id, updated_at desc);

create index decks_format_idx
  on user_data.decks (format_id);

create table user_data.deck_versions (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null
    references user_data.decks (id)
    on delete cascade,
  version_number integer not null check (version_number > 0),
  created_by_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  version_note text null,
  created_at timestamptz not null default now(),
  unique (deck_id, version_number),
  unique (id, deck_id)
);

alter table user_data.decks
  add constraint decks_current_version_same_deck_fkey
  foreign key (current_version_id, id)
  references user_data.deck_versions (id, deck_id)
  on delete restrict;

create index deck_versions_deck_idx
  on user_data.deck_versions (deck_id, created_at desc);
