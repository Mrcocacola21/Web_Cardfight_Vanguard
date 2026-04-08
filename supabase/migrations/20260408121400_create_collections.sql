create table user_data.collections (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  name text not null,
  collection_kind text not null check (
    collection_kind in ('inventory', 'binder', 'wishlist')
  ),
  description text null,
  is_default boolean not null default false,
  visibility text not null default 'private' check (
    visibility in ('private', 'friends', 'public')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index collections_owner_name_ci_idx
  on user_data.collections (owner_profile_id, lower(name));

create unique index collections_one_default_per_owner_kind_idx
  on user_data.collections (owner_profile_id, collection_kind)
  where is_default;

create index collections_owner_idx
  on user_data.collections (owner_profile_id, updated_at desc);
