update user_data.profiles
set visibility = 'private'
where visibility is distinct from 'private';

alter table user_data.profiles
  alter column visibility set default 'private';

alter table user_data.profiles
  drop constraint if exists profiles_visibility_check;

alter table user_data.profiles
  add constraint profiles_visibility_check check (
    visibility in ('public', 'private')
  );
