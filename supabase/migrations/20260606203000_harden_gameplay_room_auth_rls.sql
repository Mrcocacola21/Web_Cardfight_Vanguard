revoke all on schema gameplay from public;
revoke all on schema gameplay from anon, authenticated;
revoke all on all tables in schema gameplay from anon, authenticated;

grant usage on schema gameplay to service_role;

grant select, insert, update, delete on table gameplay.match_rooms
  to service_role;
grant select, insert, update, delete on table gameplay.room_players
  to service_role;
grant select, insert, update, delete on table gameplay.room_snapshots
  to service_role;
grant select, insert, update, delete on table gameplay.room_events
  to service_role;
grant select, insert, update, delete on table gameplay.pending_choices
  to service_role;

alter default privileges in schema gameplay
  revoke all on tables from anon, authenticated;
alter default privileges in schema gameplay
  grant select, insert, update, delete on tables to service_role;

alter table gameplay.match_rooms enable row level security;
alter table gameplay.room_players enable row level security;
alter table gameplay.room_snapshots enable row level security;
alter table gameplay.room_events enable row level security;
alter table gameplay.pending_choices enable row level security;

drop policy if exists gameplay_match_rooms_service_role_all
  on gameplay.match_rooms;
create policy gameplay_match_rooms_service_role_all
  on gameplay.match_rooms
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists gameplay_room_players_service_role_all
  on gameplay.room_players;
create policy gameplay_room_players_service_role_all
  on gameplay.room_players
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists gameplay_room_snapshots_service_role_all
  on gameplay.room_snapshots;
create policy gameplay_room_snapshots_service_role_all
  on gameplay.room_snapshots
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists gameplay_room_events_service_role_all
  on gameplay.room_events;
create policy gameplay_room_events_service_role_all
  on gameplay.room_events
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists gameplay_pending_choices_service_role_all
  on gameplay.pending_choices;
create policy gameplay_pending_choices_service_role_all
  on gameplay.pending_choices
  for all
  to service_role
  using (true)
  with check (true);
