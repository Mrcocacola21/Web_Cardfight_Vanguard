alter table social.matches
  add column if not exists entry_source text;

update social.matches
set entry_source = 'manual'
where entry_source is null;

alter table social.matches
  alter column entry_source set default 'manual',
  alter column entry_source set not null;

alter table social.matches
  drop constraint if exists matches_entry_source_check;

alter table social.matches
  add constraint matches_entry_source_check
  check (entry_source in ('manual', 'gameplay'));

alter table social.matches
  add column if not exists updated_at timestamptz;

update social.matches
set updated_at = created_at
where updated_at is null;

alter table social.matches
  alter column updated_at set default now(),
  alter column updated_at set not null;

delete from social.match_participants
where match_id in (
  select id
  from social.matches
  where recorded_by_profile_id is null
);

delete from social.matches
where recorded_by_profile_id is null;

alter table social.matches
  alter column recorded_by_profile_id set not null;
