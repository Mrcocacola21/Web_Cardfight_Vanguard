create or replace function user_data.current_profile_id()
returns uuid
language sql
stable
set search_path = user_data, auth, pg_catalog
as $$
  select profiles.id
  from user_data.profiles
  where profiles.auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function user_data.current_profile_id() from public;
grant execute on function user_data.current_profile_id() to authenticated, service_role;

drop view if exists user_data.public_profiles;

create view user_data.public_profiles
with (security_barrier = true) as
select
  profiles.id,
  profiles.display_name,
  profiles.avatar_url,
  profiles.bio
from user_data.profiles
where profiles.visibility = 'public';

grant usage on schema user_data to anon, authenticated, service_role;
grant usage on schema social to authenticated, service_role;

grant select on user_data.public_profiles to anon, authenticated, service_role;

grant select, insert, update, delete on table user_data.profiles
  to authenticated, service_role;
grant select, insert, update, delete on table user_data.collections
  to authenticated, service_role;
grant select, insert, update, delete on table user_data.collection_items
  to authenticated, service_role;
grant select, insert, update, delete on table user_data.decks
  to authenticated, service_role;
grant select, insert, update, delete on table user_data.deck_versions
  to authenticated, service_role;
grant select, insert, update, delete on table user_data.deck_cards
  to authenticated, service_role;

grant select, insert, update, delete on table social.matches
  to authenticated, service_role;
grant select, insert, update, delete on table social.match_participants
  to authenticated, service_role;

alter table user_data.profiles enable row level security;
alter table user_data.collections enable row level security;
alter table user_data.collection_items enable row level security;
alter table user_data.decks enable row level security;
alter table user_data.deck_versions enable row level security;
alter table user_data.deck_cards enable row level security;
alter table social.matches enable row level security;
alter table social.match_participants enable row level security;

drop policy if exists profiles_owner_select on user_data.profiles;
create policy profiles_owner_select
  on user_data.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists profiles_owner_insert on user_data.profiles;
create policy profiles_owner_insert
  on user_data.profiles
  for insert
  to authenticated
  with check (auth.uid() = auth_user_id);

drop policy if exists profiles_owner_update on user_data.profiles;
create policy profiles_owner_update
  on user_data.profiles
  for update
  to authenticated
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

drop policy if exists profiles_owner_delete on user_data.profiles;
create policy profiles_owner_delete
  on user_data.profiles
  for delete
  to authenticated
  using (auth.uid() = auth_user_id);

drop policy if exists collections_owner_select on user_data.collections;
create policy collections_owner_select
  on user_data.collections
  for select
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

drop policy if exists collections_owner_insert on user_data.collections;
create policy collections_owner_insert
  on user_data.collections
  for insert
  to authenticated
  with check (owner_profile_id = user_data.current_profile_id());

drop policy if exists collections_owner_update on user_data.collections;
create policy collections_owner_update
  on user_data.collections
  for update
  to authenticated
  using (owner_profile_id = user_data.current_profile_id())
  with check (owner_profile_id = user_data.current_profile_id());

drop policy if exists collections_owner_delete on user_data.collections;
create policy collections_owner_delete
  on user_data.collections
  for delete
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

drop policy if exists collection_items_owner_select on user_data.collection_items;
create policy collection_items_owner_select
  on user_data.collection_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from user_data.collections
      where collections.id = collection_items.collection_id
        and collections.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists collection_items_owner_insert on user_data.collection_items;
create policy collection_items_owner_insert
  on user_data.collection_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from user_data.collections
      where collections.id = collection_items.collection_id
        and collections.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists collection_items_owner_update on user_data.collection_items;
create policy collection_items_owner_update
  on user_data.collection_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from user_data.collections
      where collections.id = collection_items.collection_id
        and collections.owner_profile_id = user_data.current_profile_id()
    )
  )
  with check (
    exists (
      select 1
      from user_data.collections
      where collections.id = collection_items.collection_id
        and collections.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists collection_items_owner_delete on user_data.collection_items;
create policy collection_items_owner_delete
  on user_data.collection_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from user_data.collections
      where collections.id = collection_items.collection_id
        and collections.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists decks_owner_select on user_data.decks;
create policy decks_owner_select
  on user_data.decks
  for select
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

drop policy if exists decks_owner_insert on user_data.decks;
create policy decks_owner_insert
  on user_data.decks
  for insert
  to authenticated
  with check (owner_profile_id = user_data.current_profile_id());

drop policy if exists decks_owner_update on user_data.decks;
create policy decks_owner_update
  on user_data.decks
  for update
  to authenticated
  using (owner_profile_id = user_data.current_profile_id())
  with check (owner_profile_id = user_data.current_profile_id());

drop policy if exists decks_owner_delete on user_data.decks;
create policy decks_owner_delete
  on user_data.decks
  for delete
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

drop policy if exists deck_versions_owner_select on user_data.deck_versions;
create policy deck_versions_owner_select
  on user_data.deck_versions
  for select
  to authenticated
  using (
    exists (
      select 1
      from user_data.decks
      where decks.id = deck_versions.deck_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists deck_versions_owner_insert on user_data.deck_versions;
create policy deck_versions_owner_insert
  on user_data.deck_versions
  for insert
  to authenticated
  with check (
    created_by_profile_id = user_data.current_profile_id()
    and exists (
      select 1
      from user_data.decks
      where decks.id = deck_versions.deck_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists deck_versions_owner_update on user_data.deck_versions;
create policy deck_versions_owner_update
  on user_data.deck_versions
  for update
  to authenticated
  using (
    exists (
      select 1
      from user_data.decks
      where decks.id = deck_versions.deck_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  )
  with check (
    created_by_profile_id = user_data.current_profile_id()
    and exists (
      select 1
      from user_data.decks
      where decks.id = deck_versions.deck_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists deck_versions_owner_delete on user_data.deck_versions;
create policy deck_versions_owner_delete
  on user_data.deck_versions
  for delete
  to authenticated
  using (
    exists (
      select 1
      from user_data.decks
      where decks.id = deck_versions.deck_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists deck_cards_owner_select on user_data.deck_cards;
create policy deck_cards_owner_select
  on user_data.deck_cards
  for select
  to authenticated
  using (
    exists (
      select 1
      from user_data.deck_versions
      join user_data.decks on decks.id = deck_versions.deck_id
      where deck_versions.id = deck_cards.deck_version_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists deck_cards_owner_insert on user_data.deck_cards;
create policy deck_cards_owner_insert
  on user_data.deck_cards
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from user_data.deck_versions
      join user_data.decks on decks.id = deck_versions.deck_id
      where deck_versions.id = deck_cards.deck_version_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists deck_cards_owner_update on user_data.deck_cards;
create policy deck_cards_owner_update
  on user_data.deck_cards
  for update
  to authenticated
  using (
    exists (
      select 1
      from user_data.deck_versions
      join user_data.decks on decks.id = deck_versions.deck_id
      where deck_versions.id = deck_cards.deck_version_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  )
  with check (
    exists (
      select 1
      from user_data.deck_versions
      join user_data.decks on decks.id = deck_versions.deck_id
      where deck_versions.id = deck_cards.deck_version_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists deck_cards_owner_delete on user_data.deck_cards;
create policy deck_cards_owner_delete
  on user_data.deck_cards
  for delete
  to authenticated
  using (
    exists (
      select 1
      from user_data.deck_versions
      join user_data.decks on decks.id = deck_versions.deck_id
      where deck_versions.id = deck_cards.deck_version_id
        and decks.owner_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists matches_owner_select on social.matches;
create policy matches_owner_select
  on social.matches
  for select
  to authenticated
  using (recorded_by_profile_id = user_data.current_profile_id());

drop policy if exists matches_owner_insert on social.matches;
create policy matches_owner_insert
  on social.matches
  for insert
  to authenticated
  with check (recorded_by_profile_id = user_data.current_profile_id());

drop policy if exists matches_owner_update on social.matches;
create policy matches_owner_update
  on social.matches
  for update
  to authenticated
  using (recorded_by_profile_id = user_data.current_profile_id())
  with check (recorded_by_profile_id = user_data.current_profile_id());

drop policy if exists matches_owner_delete on social.matches;
create policy matches_owner_delete
  on social.matches
  for delete
  to authenticated
  using (recorded_by_profile_id = user_data.current_profile_id());

drop policy if exists match_participants_owner_select on social.match_participants;
create policy match_participants_owner_select
  on social.match_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from social.matches
      where matches.id = match_participants.match_id
        and matches.recorded_by_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists match_participants_owner_insert on social.match_participants;
create policy match_participants_owner_insert
  on social.match_participants
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from social.matches
      where matches.id = match_participants.match_id
        and matches.recorded_by_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists match_participants_owner_update on social.match_participants;
create policy match_participants_owner_update
  on social.match_participants
  for update
  to authenticated
  using (
    exists (
      select 1
      from social.matches
      where matches.id = match_participants.match_id
        and matches.recorded_by_profile_id = user_data.current_profile_id()
    )
  )
  with check (
    exists (
      select 1
      from social.matches
      where matches.id = match_participants.match_id
        and matches.recorded_by_profile_id = user_data.current_profile_id()
    )
  );

drop policy if exists match_participants_owner_delete on social.match_participants;
create policy match_participants_owner_delete
  on social.match_participants
  for delete
  to authenticated
  using (
    exists (
      select 1
      from social.matches
      where matches.id = match_participants.match_id
        and matches.recorded_by_profile_id = user_data.current_profile_id()
    )
  );
