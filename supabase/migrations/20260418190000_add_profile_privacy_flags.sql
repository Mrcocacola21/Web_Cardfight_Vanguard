alter table user_data.profiles
  add column if not exists bio_visibility text;

update user_data.profiles
set bio_visibility = case
  when visibility = 'public' then 'public'
  when visibility = 'friends' then 'friends'
  else 'private'
end
where bio_visibility is null;

alter table user_data.profiles
  alter column visibility set default 'private';

alter table user_data.profiles
  alter column bio_visibility set default 'private';

alter table user_data.profiles
  drop constraint if exists profiles_visibility_check;

alter table user_data.profiles
  add constraint profiles_visibility_check check (
    visibility in ('public', 'friends', 'private')
  );

alter table user_data.profiles
  drop constraint if exists profiles_bio_visibility_check;

alter table user_data.profiles
  add constraint profiles_bio_visibility_check check (
    bio_visibility in ('public', 'friends', 'private')
  );

alter table user_data.profiles
  alter column bio_visibility set not null;

drop view if exists social.outgoing_pending_friend_requests;
drop view if exists social.incoming_pending_friend_requests;
drop view if exists social.active_friendships_overview;
drop policy if exists friend_relationships_requester_insert
  on social.friend_relationships;
drop view if exists user_data.public_profiles;
create view user_data.public_profiles
with (security_barrier = true) as
select
  profiles.id,
  profiles.display_name,
  profiles.avatar_url,
  case
    when profiles.bio_visibility = 'public' then profiles.bio
    else null
  end as bio
from user_data.profiles
where profiles.visibility = 'public';

grant select on user_data.public_profiles to anon, authenticated, service_role;

drop view if exists user_data.visible_profiles;
create view user_data.visible_profiles
with (security_barrier = true) as
with viewer_context as (
  select
    auth.uid() as viewer_auth_user_id,
    (
      select viewer_profiles.id
      from user_data.profiles as viewer_profiles
      where viewer_profiles.auth_user_id = auth.uid()
      limit 1
    ) as viewer_profile_id
),
profile_candidates as (
  select
    profiles.id,
    profiles.display_name,
    profiles.avatar_url,
    profiles.bio,
    profiles.visibility,
    profiles.bio_visibility,
    viewer_context.viewer_auth_user_id = profiles.auth_user_id as viewer_is_owner,
    viewer_context.viewer_profile_id is not null
      and exists (
        select 1
        from social.friendships
        where (
          friendships.first_profile_id = viewer_context.viewer_profile_id
          and friendships.second_profile_id = profiles.id
        ) or (
          friendships.second_profile_id = viewer_context.viewer_profile_id
          and friendships.first_profile_id = profiles.id
        )
      ) as viewer_is_friend
  from user_data.profiles as profiles
  cross join viewer_context
)
select
  profile_candidates.id,
  profile_candidates.display_name,
  profile_candidates.avatar_url,
  case
    when profile_candidates.viewer_is_owner then profile_candidates.bio
    when profile_candidates.bio_visibility = 'public' then profile_candidates.bio
    when profile_candidates.bio_visibility = 'friends'
      and profile_candidates.viewer_is_friend then profile_candidates.bio
    else null
  end as bio,
  profile_candidates.visibility,
  profile_candidates.bio_visibility,
  (
    profile_candidates.viewer_is_owner
    or profile_candidates.bio_visibility = 'public'
    or (
      profile_candidates.bio_visibility = 'friends'
      and profile_candidates.viewer_is_friend
    )
  ) as bio_visible
from profile_candidates
where profile_candidates.viewer_is_owner
  or profile_candidates.visibility = 'public'
  or (
    profile_candidates.visibility = 'friends'
    and profile_candidates.viewer_is_friend
  );

grant select on user_data.visible_profiles to anon, authenticated, service_role;

drop policy if exists profiles_owner_select on user_data.profiles;
drop policy if exists profiles_visible_select on user_data.profiles;
create policy profiles_visible_select
  on user_data.profiles
  for select
  to authenticated
  using (auth.uid() = auth_user_id);

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

drop view if exists social.active_friendships_overview;
create view social.active_friendships_overview
with (security_barrier = true) as
select
  user_data.current_profile_id() as owner_profile_id,
  friendships.id as friendship_id,
  friendships.created_at as friends_since,
  friend_profiles.id as friend_profile_id,
  friend_profiles.display_name as friend_display_name,
  friend_profiles.avatar_url as friend_avatar_url,
  case
    when friend_profiles.bio_visibility in ('public', 'friends')
      then friend_profiles.bio
    else null
  end as friend_bio,
  (friend_profiles.visibility in ('public', 'friends')) as friend_profile_visible
from social.friendships
join user_data.profiles as friend_profiles
  on friend_profiles.id = case
    when friendships.first_profile_id = user_data.current_profile_id()
      then friendships.second_profile_id
    else friendships.first_profile_id
  end
where friendships.first_profile_id = user_data.current_profile_id()
  or friendships.second_profile_id = user_data.current_profile_id();

grant select on social.active_friendships_overview
  to authenticated, service_role;

drop view if exists social.incoming_pending_friend_requests;
create view social.incoming_pending_friend_requests
with (security_barrier = true) as
select
  friend_relationships.id as request_id,
  friend_relationships.requested_at,
  friend_relationships.requester_profile_id,
  friend_relationships.addressee_profile_id as recipient_profile_id,
  requester_profiles.display_name as requester_display_name,
  requester_profiles.avatar_url as requester_avatar_url,
  case
    when requester_profiles.bio_visibility = 'public'
      then requester_profiles.bio
    else null
  end as requester_bio,
  (requester_profiles.visibility = 'public') as requester_profile_visible
from social.friend_relationships
join user_data.profiles as requester_profiles
  on requester_profiles.id = friend_relationships.requester_profile_id
where friend_relationships.status = 'pending'
  and friend_relationships.addressee_profile_id = user_data.current_profile_id();

grant select on social.incoming_pending_friend_requests
  to authenticated, service_role;

drop view if exists social.outgoing_pending_friend_requests;
create view social.outgoing_pending_friend_requests
with (security_barrier = true) as
select
  friend_relationships.id as request_id,
  friend_relationships.requested_at,
  friend_relationships.requester_profile_id,
  friend_relationships.addressee_profile_id as recipient_profile_id,
  recipient_profiles.display_name as recipient_display_name,
  recipient_profiles.avatar_url as recipient_avatar_url,
  case
    when recipient_profiles.bio_visibility = 'public'
      then recipient_profiles.bio
    else null
  end as recipient_bio,
  (recipient_profiles.visibility = 'public') as recipient_profile_visible
from social.friend_relationships
join user_data.profiles as recipient_profiles
  on recipient_profiles.id = friend_relationships.addressee_profile_id
where friend_relationships.status = 'pending'
  and friend_relationships.requester_profile_id = user_data.current_profile_id();

grant select on social.outgoing_pending_friend_requests
  to authenticated, service_role;
