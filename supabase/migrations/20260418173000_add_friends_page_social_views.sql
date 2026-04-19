drop view if exists social.active_friendships_overview;
create view social.active_friendships_overview
with (security_barrier = true) as
select
  user_data.current_profile_id() as owner_profile_id,
  friendships.id as friendship_id,
  friendships.created_at as friends_since,
  case
    when friendships.first_profile_id = user_data.current_profile_id()
      then friendships.second_profile_id
    else friendships.first_profile_id
  end as friend_profile_id,
  coalesce(public_profiles.display_name, 'Private profile') as friend_display_name,
  public_profiles.avatar_url as friend_avatar_url,
  public_profiles.bio as friend_bio,
  (public_profiles.id is not null) as friend_profile_visible
from social.friendships
left join user_data.public_profiles
  on public_profiles.id = case
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
  coalesce(public_profiles.display_name, 'Private profile') as requester_display_name,
  public_profiles.avatar_url as requester_avatar_url,
  public_profiles.bio as requester_bio,
  (public_profiles.id is not null) as requester_profile_visible
from social.friend_relationships
left join user_data.public_profiles
  on public_profiles.id = friend_relationships.requester_profile_id
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
  coalesce(public_profiles.display_name, 'Private profile') as recipient_display_name,
  public_profiles.avatar_url as recipient_avatar_url,
  public_profiles.bio as recipient_bio,
  (public_profiles.id is not null) as recipient_profile_visible
from social.friend_relationships
left join user_data.public_profiles
  on public_profiles.id = friend_relationships.addressee_profile_id
where friend_relationships.status = 'pending'
  and friend_relationships.requester_profile_id = user_data.current_profile_id();

grant select on social.outgoing_pending_friend_requests
  to authenticated, service_role;
