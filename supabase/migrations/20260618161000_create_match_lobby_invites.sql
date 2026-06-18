create table social.match_lobby_invites (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  invitee_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  format_id text not null
    references legality.formats (id)
    on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined', 'cancelled', 'started')
  ),
  requester_deck_id uuid null
    references user_data.decks (id)
    on delete set null,
  invitee_deck_id uuid null
    references user_data.decks (id)
    on delete set null,
  requester_ready boolean not null default false,
  invitee_ready boolean not null default false,
  started_room_id uuid null
    references gameplay.match_rooms (id)
    on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  updated_at timestamptz not null default now(),
  check (requester_profile_id <> invitee_profile_id),
  check (
    (status in ('pending', 'cancelled') and responded_at is null)
    or (status in ('accepted', 'declined', 'started') and responded_at is not null)
  ),
  check (
    (status = 'started' and started_room_id is not null)
    or (status <> 'started' and started_room_id is null)
  )
);

create index match_lobby_invites_requester_status_idx
  on social.match_lobby_invites (requester_profile_id, status, created_at desc);

create index match_lobby_invites_invitee_status_idx
  on social.match_lobby_invites (invitee_profile_id, status, created_at desc);

grant select, insert on table social.match_lobby_invites
  to authenticated, service_role;
grant update (
  status,
  requester_deck_id,
  invitee_deck_id,
  requester_ready,
  invitee_ready,
  responded_at,
  updated_at
) on table social.match_lobby_invites
  to authenticated;
grant update on table social.match_lobby_invites
  to service_role;

alter table social.match_lobby_invites enable row level security;

drop policy if exists match_lobby_invites_participant_select
  on social.match_lobby_invites;
create policy match_lobby_invites_participant_select
  on social.match_lobby_invites
  for select
  to authenticated
  using (
    requester_profile_id = user_data.current_profile_id()
    or invitee_profile_id = user_data.current_profile_id()
  );

drop policy if exists match_lobby_invites_requester_insert
  on social.match_lobby_invites;
create policy match_lobby_invites_requester_insert
  on social.match_lobby_invites
  for insert
  to authenticated
  with check (
    requester_profile_id = user_data.current_profile_id()
    and requester_profile_id <> invitee_profile_id
    and exists (
      select 1
      from user_data.visible_profiles
      where visible_profiles.id = invitee_profile_id
    )
  );

drop policy if exists match_lobby_invites_participant_update
  on social.match_lobby_invites;
create policy match_lobby_invites_participant_update
  on social.match_lobby_invites
  for update
  to authenticated
  using (
    requester_profile_id = user_data.current_profile_id()
    or invitee_profile_id = user_data.current_profile_id()
  )
  with check (
    requester_profile_id = user_data.current_profile_id()
    or invitee_profile_id = user_data.current_profile_id()
  );
