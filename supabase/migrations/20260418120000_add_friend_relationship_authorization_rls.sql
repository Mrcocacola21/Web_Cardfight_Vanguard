grant select, insert on table social.friend_relationships
  to authenticated, service_role;

alter table social.friend_relationships enable row level security;

drop policy if exists friend_relationships_participant_select on social.friend_relationships;
create policy friend_relationships_participant_select
  on social.friend_relationships
  for select
  to authenticated
  using (
    requester_profile_id = user_data.current_profile_id()
    or addressee_profile_id = user_data.current_profile_id()
  );

drop policy if exists friend_relationships_requester_insert on social.friend_relationships;
create policy friend_relationships_requester_insert
  on social.friend_relationships
  for insert
  to authenticated
  with check (
    requester_profile_id = user_data.current_profile_id()
    and requester_profile_id <> addressee_profile_id
    and exists (
      select 1
      from user_data.public_profiles
      where public_profiles.id = addressee_profile_id
    )
  );
