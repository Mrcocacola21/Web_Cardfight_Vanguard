create or replace function gameplay.create_persisted_match_session(
  create_payload jsonb default '{}'::jsonb
)
returns table (
  room_id uuid,
  persisted_at timestamptz,
  document jsonb
)
language plpgsql
security invoker
set search_path = gameplay, pg_catalog
as $$
declare
  room_payload jsonb := create_payload -> 'room';
  snapshot_payload jsonb := create_payload -> 'snapshot';
  document_payload jsonb := create_payload -> 'document';
  room_id_value uuid;
  persisted_at_value timestamptz;
  expected_history_length integer;
begin
  if jsonb_typeof(create_payload) is distinct from 'object' then
    raise exception
      using errcode = '22023',
            message = 'Persisted match session create payload must be a JSON object.';
  end if;

  if jsonb_typeof(room_payload) is distinct from 'object'
    or jsonb_typeof(snapshot_payload) is distinct from 'object'
    or jsonb_typeof(document_payload) is distinct from 'object' then
    raise exception
      using errcode = '22023',
            message = 'Persisted match session create payload is missing room, snapshot, or document.';
  end if;

  room_id_value := (room_payload ->> 'id')::uuid;
  persisted_at_value := (create_payload ->> 'persistedAt')::timestamptz;
  expected_history_length := jsonb_array_length(document_payload -> 'history');

  if expected_history_length is distinct from jsonb_array_length(
    coalesce(create_payload -> 'events', '[]'::jsonb)
  ) then
    raise exception
      using errcode = 'VG003',
            message = 'Persisted match session create history does not match event rows.',
            detail = format(
              'Room %s document history length differs from the accepted event payload.',
              room_id_value
            );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(create_payload -> 'events', '[]'::jsonb))
      with ordinality as event_row(payload, ordinality)
    where (event_row.payload ->> 'event_sequence')::bigint <> event_row.ordinality
  ) then
    raise exception
      using errcode = 'VG003',
            message = 'Persisted match session create history is out of order.',
            detail = format('Room %s event rows must start at sequence 1.', room_id_value);
  end if;

  insert into gameplay.match_rooms (
    id,
    format_id,
    host_profile_id,
    status,
    latest_event_sequence,
    latest_snapshot_sequence,
    created_at,
    started_at,
    ended_at,
    updated_at
  ) values (
    room_id_value,
    room_payload ->> 'format_id',
    nullif(room_payload ->> 'host_profile_id', '')::uuid,
    room_payload ->> 'status',
    (room_payload ->> 'latest_event_sequence')::bigint,
    (room_payload ->> 'latest_snapshot_sequence')::integer,
    (room_payload ->> 'created_at')::timestamptz,
    nullif(room_payload ->> 'started_at', '')::timestamptz,
    nullif(room_payload ->> 'ended_at', '')::timestamptz,
    (room_payload ->> 'updated_at')::timestamptz
  );

  insert into gameplay.room_players (
    id,
    room_id,
    profile_id,
    seat_order,
    player_status,
    submitted_deck_version_id,
    submitted_deck_snapshot,
    joined_at,
    updated_at
  )
  select
    player_row.id,
    room_id_value,
    player_row.profile_id,
    player_row.seat_order,
    player_row.player_status,
    player_row.submitted_deck_version_id,
    player_row.submitted_deck_snapshot,
    persisted_at_value,
    persisted_at_value
  from jsonb_to_recordset(coalesce(create_payload -> 'roomPlayers', '[]'::jsonb))
    as player_row(
      id uuid,
      profile_id uuid,
      seat_order smallint,
      player_status text,
      submitted_deck_version_id uuid,
      submitted_deck_snapshot jsonb
    );

  insert into gameplay.room_events (
    room_id,
    event_sequence,
    actor_room_player_id,
    event_kind,
    source_kind,
    source_ref,
    event_payload,
    created_at
  )
  select
    room_id_value,
    event_row.event_sequence,
    event_row.actor_room_player_id,
    event_row.event_kind,
    event_row.source_kind,
    event_row.source_ref,
    event_row.event_payload,
    event_row.created_at
  from jsonb_to_recordset(coalesce(create_payload -> 'events', '[]'::jsonb))
    as event_row(
      event_sequence bigint,
      actor_room_player_id uuid,
      event_kind text,
      source_kind text,
      source_ref text,
      event_payload jsonb,
      created_at timestamptz
    );

  insert into gameplay.room_snapshots (
    room_id,
    snapshot_sequence,
    last_event_sequence,
    turn_number,
    phase_key,
    active_room_player_id,
    is_current,
    game_state_payload,
    created_at
  ) values (
    room_id_value,
    (snapshot_payload ->> 'snapshot_sequence')::integer,
    (snapshot_payload ->> 'last_event_sequence')::bigint,
    nullif(snapshot_payload ->> 'turn_number', '')::integer,
    nullif(snapshot_payload ->> 'phase_key', ''),
    nullif(snapshot_payload ->> 'active_room_player_id', '')::uuid,
    true,
    snapshot_payload -> 'game_state_payload',
    (snapshot_payload ->> 'created_at')::timestamptz
  );

  insert into gameplay.pending_choices (
    id,
    room_id,
    owner_kind,
    owner_room_player_id,
    choice_kind,
    opened_event_sequence,
    options_payload,
    context_payload,
    created_at,
    updated_at
  )
  select
    choice_row.id,
    room_id_value,
    choice_row.owner_kind,
    choice_row.owner_room_player_id,
    choice_row.choice_kind,
    choice_row.opened_event_sequence,
    choice_row.options_payload,
    choice_row.context_payload,
    choice_row.created_at,
    choice_row.updated_at
  from jsonb_to_recordset(coalesce(create_payload -> 'pendingChoices', '[]'::jsonb))
    as choice_row(
      id uuid,
      owner_kind text,
      owner_room_player_id uuid,
      choice_kind text,
      opened_event_sequence bigint,
      options_payload jsonb,
      context_payload jsonb,
      created_at timestamptz,
      updated_at timestamptz
    );

  return query
  select room_id_value, persisted_at_value, document_payload;
end;
$$;

create or replace function gameplay.persist_accepted_match_session_transition(
  transition_payload jsonb default '{}'::jsonb
)
returns table (
  room_id uuid,
  persisted_at timestamptz,
  document jsonb
)
language plpgsql
security invoker
set search_path = gameplay, pg_catalog
as $$
declare
  room_payload jsonb := transition_payload -> 'room';
  snapshot_payload jsonb := transition_payload -> 'snapshot';
  document_payload jsonb := transition_payload -> 'document';
  room_id_value uuid;
  persisted_at_value timestamptz;
  expected_room_revision integer;
  expected_history_length integer;
  current_room gameplay.match_rooms%rowtype;
  current_snapshot gameplay.room_snapshots%rowtype;
  next_history_length integer;
  appended_event_count integer;
  next_snapshot_sequence integer;
begin
  if jsonb_typeof(transition_payload) is distinct from 'object' then
    raise exception
      using errcode = '22023',
            message = 'Persisted match session transition payload must be a JSON object.';
  end if;

  if jsonb_typeof(room_payload) is distinct from 'object'
    or jsonb_typeof(snapshot_payload) is distinct from 'object'
    or jsonb_typeof(document_payload) is distinct from 'object' then
    raise exception
      using errcode = '22023',
            message = 'Persisted match session transition payload is missing room, snapshot, or document.';
  end if;

  room_id_value := (room_payload ->> 'id')::uuid;
  persisted_at_value := (transition_payload ->> 'persistedAt')::timestamptz;
  expected_room_revision := (transition_payload ->> 'expectedRoomRevision')::integer;
  expected_history_length := (transition_payload ->> 'expectedHistoryLength')::integer;
  next_history_length := jsonb_array_length(document_payload -> 'history');
  appended_event_count := jsonb_array_length(
    coalesce(transition_payload -> 'events', '[]'::jsonb)
  );

  select *
  into current_room
  from gameplay.match_rooms as match_room
  where match_room.id = room_id_value
  for update;

  if not found then
    raise exception
      using errcode = 'VG001',
            message = 'Persisted match room was not found.',
            detail = format('Room %s could not be loaded for transition persistence.', room_id_value);
  end if;

  select *
  into current_snapshot
  from gameplay.room_snapshots as room_snapshot
  where room_snapshot.room_id = room_id_value
    and room_snapshot.is_current
  for update;

  if not found then
    raise exception
      using errcode = 'VG004',
            message = 'Persisted match room has no current snapshot.',
            detail = format('Room %s cannot persist a transition without a current snapshot.', room_id_value);
  end if;

  if (current_snapshot.game_state_payload #>> '{room,revision}')::integer
    is distinct from expected_room_revision then
    raise exception
      using errcode = 'VG002',
            message = 'Persisted match room revision is stale.',
            detail = format(
              'Room %s is at revision %s, not %s.',
              room_id_value,
              current_snapshot.game_state_payload #>> '{room,revision}',
              expected_room_revision
            );
  end if;

  if jsonb_array_length(current_snapshot.game_state_payload -> 'history')
    is distinct from expected_history_length
    or current_room.latest_event_sequence is distinct from expected_history_length then
    raise exception
      using errcode = 'VG003',
            message = 'Persisted match room history boundary is stale.',
            detail = format(
              'Room %s expected %s history rows before transition.',
              room_id_value,
              expected_history_length
            );
  end if;

  if next_history_length - expected_history_length is distinct from appended_event_count then
    raise exception
      using errcode = 'VG003',
            message = 'Persisted match room appended history does not match next snapshot.',
            detail = format(
              'Room %s appends %s event rows but next document advances history from %s to %s.',
              room_id_value,
              appended_event_count,
              expected_history_length,
              next_history_length
            );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(transition_payload -> 'events', '[]'::jsonb))
      with ordinality as event_row(payload, ordinality)
    where (event_row.payload ->> 'event_sequence')::bigint
      <> expected_history_length + event_row.ordinality
  ) then
    raise exception
      using errcode = 'VG003',
            message = 'Persisted match room appended history is out of order.',
            detail = format('Room %s appended event rows are not contiguous.', room_id_value);
  end if;

  next_snapshot_sequence := current_room.latest_snapshot_sequence + 1;

  update gameplay.room_snapshots
  set is_current = false
  where gameplay.room_snapshots.room_id = room_id_value
    and gameplay.room_snapshots.is_current;

  insert into gameplay.room_events (
    room_id,
    event_sequence,
    actor_room_player_id,
    event_kind,
    source_kind,
    source_ref,
    event_payload,
    created_at
  )
  select
    room_id_value,
    event_row.event_sequence,
    event_row.actor_room_player_id,
    event_row.event_kind,
    event_row.source_kind,
    event_row.source_ref,
    event_row.event_payload,
    event_row.created_at
  from jsonb_to_recordset(coalesce(transition_payload -> 'events', '[]'::jsonb))
    as event_row(
      event_sequence bigint,
      actor_room_player_id uuid,
      event_kind text,
      source_kind text,
      source_ref text,
      event_payload jsonb,
      created_at timestamptz
    );

  delete from gameplay.pending_choices
  where gameplay.pending_choices.room_id = room_id_value
    and gameplay.pending_choices.status = 'pending';

  insert into gameplay.pending_choices (
    id,
    room_id,
    owner_kind,
    owner_room_player_id,
    choice_kind,
    opened_event_sequence,
    options_payload,
    context_payload,
    created_at,
    updated_at
  )
  select
    choice_row.id,
    room_id_value,
    choice_row.owner_kind,
    choice_row.owner_room_player_id,
    choice_row.choice_kind,
    choice_row.opened_event_sequence,
    choice_row.options_payload,
    choice_row.context_payload,
    choice_row.created_at,
    choice_row.updated_at
  from jsonb_to_recordset(coalesce(transition_payload -> 'pendingChoices', '[]'::jsonb))
    as choice_row(
      id uuid,
      owner_kind text,
      owner_room_player_id uuid,
      choice_kind text,
      opened_event_sequence bigint,
      options_payload jsonb,
      context_payload jsonb,
      created_at timestamptz,
      updated_at timestamptz
    );

  insert into gameplay.room_snapshots (
    room_id,
    snapshot_sequence,
    last_event_sequence,
    turn_number,
    phase_key,
    active_room_player_id,
    is_current,
    game_state_payload,
    created_at
  ) values (
    room_id_value,
    next_snapshot_sequence,
    next_history_length,
    nullif(snapshot_payload ->> 'turn_number', '')::integer,
    nullif(snapshot_payload ->> 'phase_key', ''),
    nullif(snapshot_payload ->> 'active_room_player_id', '')::uuid,
    true,
    snapshot_payload -> 'game_state_payload',
    (snapshot_payload ->> 'created_at')::timestamptz
  );

  update gameplay.match_rooms
  set
    status = room_payload ->> 'status',
    latest_event_sequence = next_history_length,
    latest_snapshot_sequence = next_snapshot_sequence,
    started_at = nullif(room_payload ->> 'started_at', '')::timestamptz,
    ended_at = nullif(room_payload ->> 'ended_at', '')::timestamptz,
    updated_at = persisted_at_value
  where gameplay.match_rooms.id = room_id_value;

  return query
  select room_id_value, persisted_at_value, document_payload;
end;
$$;

revoke all
  on function gameplay.create_persisted_match_session(jsonb)
  from public;

revoke all
  on function gameplay.persist_accepted_match_session_transition(jsonb)
  from public;

grant execute
  on function gameplay.create_persisted_match_session(jsonb)
  to service_role;

grant execute
  on function gameplay.persist_accepted_match_session_transition(jsonb)
  to service_role;
