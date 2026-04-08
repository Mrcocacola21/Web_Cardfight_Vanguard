create table user_data.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid null unique
    references auth.users (id)
    on delete set null,
  username text null,
  display_name text not null,
  bio text null,
  avatar_url text null,
  visibility text not null default 'public' check (
    visibility in ('public', 'friends', 'private')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    username is null
    or username ~ '^[A-Za-z0-9_]{3,32}$'
  )
);

create unique index profiles_username_ci_idx
  on user_data.profiles (lower(username))
  where username is not null;
