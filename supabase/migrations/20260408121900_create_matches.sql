create table social.matches (
  id uuid primary key default gen_random_uuid(),
  recorded_by_profile_id uuid null
    references user_data.profiles (id)
    on delete set null,
  format_id text not null
    references legality.formats (id)
    on delete restrict,
  visibility text not null default 'private' check (
    visibility in ('private', 'friends', 'public')
  ),
  status text not null default 'completed' check (
    status in ('recorded', 'completed', 'voided')
  ),
  occurred_at timestamptz not null default now(),
  notes text null,
  created_at timestamptz not null default now()
);

create index matches_recorded_by_idx
  on social.matches (recorded_by_profile_id, occurred_at desc);

create index matches_format_idx
  on social.matches (format_id, occurred_at desc);

create table social.match_participants (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null
    references social.matches (id)
    on delete cascade,
  profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  deck_version_id uuid null
    references user_data.deck_versions (id)
    on delete set null,
  seat_order smallint null check (seat_order is null or seat_order > 0),
  result text not null check (
    result in ('win', 'loss', 'draw', 'forfeit', 'unknown')
  ),
  notes text null,
  unique (match_id, profile_id)
);

create unique index match_participants_match_seat_idx
  on social.match_participants (match_id, seat_order)
  where seat_order is not null;

create index match_participants_profile_idx
  on social.match_participants (profile_id);

create index match_participants_deck_version_idx
  on social.match_participants (deck_version_id)
  where deck_version_id is not null;
