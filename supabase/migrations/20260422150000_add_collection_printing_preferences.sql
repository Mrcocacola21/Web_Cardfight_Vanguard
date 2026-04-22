create table if not exists user_data.collection_printing_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null
    references user_data.profiles (id)
    on delete restrict,
  card_printing_id uuid not null
    references catalog.card_printings (id)
    on delete restrict,
  preference_kind text not null
    check (preference_kind in ('wishlist', 'favorite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_profile_id, card_printing_id, preference_kind)
);

create index if not exists collection_printing_preferences_owner_kind_idx
  on user_data.collection_printing_preferences (
    owner_profile_id,
    preference_kind,
    updated_at desc
  );

alter table user_data.collection_printing_preferences force row level security;

create policy collection_printing_preferences_owner_select
  on user_data.collection_printing_preferences
  for select
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

create policy collection_printing_preferences_owner_insert
  on user_data.collection_printing_preferences
  for insert
  to authenticated
  with check (owner_profile_id = user_data.current_profile_id());

create policy collection_printing_preferences_owner_update
  on user_data.collection_printing_preferences
  for update
  to authenticated
  using (owner_profile_id = user_data.current_profile_id())
  with check (owner_profile_id = user_data.current_profile_id());

create policy collection_printing_preferences_owner_delete
  on user_data.collection_printing_preferences
  for delete
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

drop function if exists user_data.prevent_collection_printing_preference_identity_reassignment();
create function user_data.prevent_collection_printing_preference_identity_reassignment()
returns trigger
language plpgsql
set search_path = user_data, pg_catalog
as $$
begin
  if new.owner_profile_id is distinct from old.owner_profile_id then
    raise exception
      'Collection printing preference ownership cannot be reassigned after creation.'
      using errcode = '23514';
  end if;

  if new.card_printing_id is distinct from old.card_printing_id then
    raise exception
      'Collection printing preferences cannot be reassigned to a different printing.'
      using errcode = '23514';
  end if;

  if new.preference_kind is distinct from old.preference_kind then
    raise exception
      'Collection printing preference kind cannot be reassigned after creation.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists collection_printing_preferences_prevent_identity_reassignment_trigger
  on user_data.collection_printing_preferences;
create trigger collection_printing_preferences_prevent_identity_reassignment_trigger
before update of owner_profile_id, card_printing_id, preference_kind
on user_data.collection_printing_preferences
for each row
execute function user_data.prevent_collection_printing_preference_identity_reassignment();
