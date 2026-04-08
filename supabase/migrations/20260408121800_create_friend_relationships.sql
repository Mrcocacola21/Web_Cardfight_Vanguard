create table social.friend_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  addressee_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  status text not null check (
    status in ('pending', 'accepted', 'declined', 'cancelled')
  ),
  requested_at timestamptz not null default now(),
  responded_at timestamptz null,
  check (requester_profile_id <> addressee_profile_id),
  check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

create unique index friend_relationships_unique_pair_idx
  on social.friend_relationships (
    least(requester_profile_id, addressee_profile_id),
    greatest(requester_profile_id, addressee_profile_id)
  );

create index friend_relationships_addressee_status_idx
  on social.friend_relationships (addressee_profile_id, status, requested_at desc);

create index friend_relationships_requester_status_idx
  on social.friend_relationships (requester_profile_id, status, requested_at desc);
