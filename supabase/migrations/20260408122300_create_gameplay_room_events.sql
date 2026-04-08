create table gameplay.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null
    references gameplay.match_rooms (id)
    on delete cascade,
  event_sequence bigint not null check (event_sequence > 0),
  actor_room_player_id uuid null,
  event_kind text not null,
  source_kind text not null check (
    source_kind in (
      'player-action',
      'system',
      'effect',
      'trigger',
      'replacement',
      'continuous',
      'setup'
    )
  ),
  source_ref text null,
  event_payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (room_id, event_sequence),
  foreign key (room_id, actor_room_player_id)
    references gameplay.room_players (room_id, id)
    on delete restrict
);

create index gameplay_room_events_room_kind_idx
  on gameplay.room_events (room_id, event_kind, event_sequence desc);

create index gameplay_room_events_actor_idx
  on gameplay.room_events (actor_room_player_id, event_sequence desc)
  where actor_room_player_id is not null;
