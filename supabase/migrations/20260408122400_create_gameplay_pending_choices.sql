create table gameplay.pending_choices (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null
    references gameplay.match_rooms (id)
    on delete cascade,
  owner_kind text not null check (
    owner_kind in ('player', 'system')
  ),
  owner_room_player_id uuid null,
  choice_kind text not null,
  status text not null default 'pending' check (
    status in ('pending', 'resolved', 'cancelled')
  ),
  opened_event_sequence bigint not null check (opened_event_sequence >= 0),
  resolved_event_sequence bigint null check (
    resolved_event_sequence is null or resolved_event_sequence >= opened_event_sequence
  ),
  options_payload jsonb not null,
  context_payload jsonb not null default '{}'::jsonb,
  resolution_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (room_id, owner_room_player_id)
    references gameplay.room_players (room_id, id)
    on delete restrict,
  check (
    (owner_kind = 'player' and owner_room_player_id is not null)
    or (owner_kind = 'system' and owner_room_player_id is null)
  ),
  check (
    (status = 'pending' and resolved_event_sequence is null and resolution_payload is null)
    or (status = 'resolved' and resolved_event_sequence is not null and resolution_payload is not null)
    or (status = 'cancelled' and resolved_event_sequence is null)
  )
);

create index gameplay_pending_choices_room_status_idx
  on gameplay.pending_choices (room_id, status, created_at desc);

create index gameplay_pending_choices_owner_idx
  on gameplay.pending_choices (owner_room_player_id, status, created_at desc)
  where owner_room_player_id is not null;
