grant delete on table social.friendships to authenticated;

drop policy if exists friendships_participant_delete on social.friendships;
create policy friendships_participant_delete
  on social.friendships
  for delete
  to authenticated
  using (
    first_profile_id = user_data.current_profile_id()
    or second_profile_id = user_data.current_profile_id()
  );
