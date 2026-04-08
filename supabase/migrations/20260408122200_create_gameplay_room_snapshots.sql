create table gameplay.room_snapshots (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null
    references gameplay.match_rooms (id)
    on delete cascade,
  snapshot_sequence integer not null check (snapshot_sequence > 0),
  last_event_sequence bigint not null check (last_event_sequence >= 0),
  turn_number integer null check (turn_number is null or turn_number > 0),
  phase_key text null,
  active_room_player_id uuid null,
  is_current boolean not null default false,
  game_state_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (room_id, snapshot_sequence),
  foreign key (room_id, active_room_player_id)
    references gameplay.room_players (room_id, id)
    on delete restrict
);

create unique index gameplay_room_snapshots_one_current_idx
  on gameplay.room_snapshots (room_id)
  where is_current;

create index gameplay_room_snapshots_room_event_idx
  on gameplay.room_snapshots (room_id, last_event_sequence desc);
