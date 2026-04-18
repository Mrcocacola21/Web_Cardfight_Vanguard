create table if not exists social.friendships (
  id uuid primary key default gen_random_uuid(),
  first_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  second_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  friend_request_id uuid not null unique
    references social.friend_relationships (id)
    on delete restrict,
  created_at timestamptz not null default now(),
  check (first_profile_id <> second_profile_id),
  check (first_profile_id < second_profile_id)
);

create unique index if not exists friendships_unique_pair_idx
  on social.friendships (first_profile_id, second_profile_id);

grant select on table social.friendships to authenticated, service_role;
grant insert, update, delete on table social.friendships to service_role;
grant update (status, responded_at) on table social.friend_relationships
  to authenticated;
grant update on table social.friend_relationships to service_role;

alter table social.friendships enable row level security;

drop policy if exists friendships_participant_select on social.friendships;
create policy friendships_participant_select
  on social.friendships
  for select
  to authenticated
  using (
    first_profile_id = user_data.current_profile_id()
    or second_profile_id = user_data.current_profile_id()
  );

drop policy if exists friend_relationships_recipient_update on social.friend_relationships;
create policy friend_relationships_recipient_update
  on social.friend_relationships
  for update
  to authenticated
  using (
    addressee_profile_id = user_data.current_profile_id()
    and status = 'pending'
  )
  with check (
    addressee_profile_id = user_data.current_profile_id()
    and requester_profile_id <> addressee_profile_id
    and status in ('accepted', 'declined')
    and responded_at is not null
  );

drop function if exists social.sync_friendship_from_accepted_request();
create function social.sync_friendship_from_accepted_request()
returns trigger
language plpgsql
security definer
set search_path = social, user_data, pg_catalog
as $$
begin
  if new.status <> 'accepted' then
    return new;
  end if;

  insert into social.friendships (
    first_profile_id,
    second_profile_id,
    friend_request_id,
    created_at
  )
  values (
    least(new.requester_profile_id, new.addressee_profile_id),
    greatest(new.requester_profile_id, new.addressee_profile_id),
    new.id,
    coalesce(new.responded_at, now())
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists friend_relationships_sync_friendship_trigger
  on social.friend_relationships;
create trigger friend_relationships_sync_friendship_trigger
after insert or update of status
on social.friend_relationships
for each row
execute function social.sync_friendship_from_accepted_request();

insert into social.friendships (
  first_profile_id,
  second_profile_id,
  friend_request_id,
  created_at
)
select
  least(friend_relationships.requester_profile_id, friend_relationships.addressee_profile_id),
  greatest(friend_relationships.requester_profile_id, friend_relationships.addressee_profile_id),
  friend_relationships.id,
  coalesce(friend_relationships.responded_at, friend_relationships.requested_at)
from social.friend_relationships
where friend_relationships.status = 'accepted'
on conflict do nothing;

drop view if exists social.incoming_pending_friend_requests;
create view social.incoming_pending_friend_requests
with (security_barrier = true) as
select
  friend_relationships.id as request_id,
  friend_relationships.requested_at,
  friend_relationships.requester_profile_id,
  friend_relationships.addressee_profile_id as recipient_profile_id,
  profiles.display_name as requester_display_name,
  profiles.avatar_url as requester_avatar_url
from social.friend_relationships
join user_data.profiles
  on profiles.id = friend_relationships.requester_profile_id
where friend_relationships.status = 'pending'
  and friend_relationships.addressee_profile_id = user_data.current_profile_id();

grant select on social.incoming_pending_friend_requests
  to authenticated, service_role;
