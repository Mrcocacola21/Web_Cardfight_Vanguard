create table gameplay.match_rooms (
  id uuid primary key default gen_random_uuid(),
  format_id text not null
    references legality.formats (id)
    on delete restrict,
  host_profile_id uuid null
    references user_data.profiles (id)
    on delete set null,
  social_match_id uuid null unique
    references social.matches (id)
    on delete set null,
  status text not null default 'setup' check (
    status in ('setup', 'active', 'paused', 'completed', 'abandoned')
  ),
  latest_event_sequence bigint not null default 0 check (latest_event_sequence >= 0),
  latest_snapshot_sequence integer not null default 0 check (latest_snapshot_sequence >= 0),
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  ended_at timestamptz null,
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= created_at),
  check (started_at is null or started_at >= created_at),
  check (ended_at is null or started_at is not null or status = 'abandoned')
);

create index gameplay_match_rooms_status_idx
  on gameplay.match_rooms (status, updated_at desc);

create index gameplay_match_rooms_format_idx
  on gameplay.match_rooms (format_id, created_at desc);
