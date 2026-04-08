create table gameplay.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null
    references gameplay.match_rooms (id)
    on delete cascade,
  profile_id uuid null
    references user_data.profiles (id)
    on delete set null,
  submitted_deck_version_id uuid null
    references user_data.deck_versions (id)
    on delete set null,
  seat_order smallint not null check (seat_order > 0),
  player_status text not null default 'joined' check (
    player_status in ('joined', 'ready', 'active', 'disconnected', 'left')
  ),
  submitted_deck_snapshot jsonb null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, seat_order),
  unique (room_id, id),
  unique (room_id, profile_id)
);

create index gameplay_room_players_room_status_idx
  on gameplay.room_players (room_id, player_status, seat_order);

create index gameplay_room_players_profile_idx
  on gameplay.room_players (profile_id)
  where profile_id is not null;
