alter table user_data.decks force row level security;
alter table user_data.deck_versions force row level security;
alter table user_data.deck_cards force row level security;

revoke update
  on table user_data.deck_versions
  from authenticated;

revoke update
  on table user_data.deck_cards
  from authenticated;

drop policy if exists deck_versions_owner_update on user_data.deck_versions;
drop policy if exists deck_cards_owner_update on user_data.deck_cards;

do $$
begin
  if exists (
    select 1
    from user_data.deck_versions
    join user_data.decks
      on decks.id = deck_versions.deck_id
    where deck_versions.created_by_profile_id <> decks.owner_profile_id
  ) then
    raise exception
      'Existing deck_versions rows violate deck owner consistency.'
      using errcode = '23514';
  end if;
end;
$$;

drop function if exists user_data.prevent_deck_owner_reassignment();
create function user_data.prevent_deck_owner_reassignment()
returns trigger
language plpgsql
set search_path = user_data, pg_catalog
as $$
begin
  if new.owner_profile_id is distinct from old.owner_profile_id then
    raise exception
      'Deck ownership cannot be reassigned after creation.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists decks_prevent_owner_reassignment_trigger
  on user_data.decks;
create trigger decks_prevent_owner_reassignment_trigger
before update of owner_profile_id
on user_data.decks
for each row
execute function user_data.prevent_deck_owner_reassignment();

drop function if exists user_data.enforce_deck_version_ownership();
create function user_data.enforce_deck_version_ownership()
returns trigger
language plpgsql
set search_path = user_data, pg_catalog
as $$
declare
  deck_owner_profile_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.deck_id is distinct from old.deck_id then
      raise exception
        'Deck versions cannot be moved to another deck.'
        using errcode = '23514';
    end if;

    if new.created_by_profile_id is distinct from old.created_by_profile_id then
      raise exception
        'Deck version creator cannot be reassigned.'
        using errcode = '23514';
    end if;
  end if;

  select decks.owner_profile_id
  into deck_owner_profile_id
  from user_data.decks
  where decks.id = new.deck_id;

  if deck_owner_profile_id is null then
    return new;
  end if;

  if new.created_by_profile_id <> deck_owner_profile_id then
    raise exception
      'Deck versions must be created by the owning profile.'
      using errcode = '23514',
            detail = format(
              'Deck %s is owned by %s but deck version creator is %s.',
              new.deck_id,
              deck_owner_profile_id,
              new.created_by_profile_id
            );
  end if;

  return new;
end;
$$;

drop trigger if exists deck_versions_enforce_owner_trigger
  on user_data.deck_versions;
create trigger deck_versions_enforce_owner_trigger
before insert or update of deck_id, created_by_profile_id
on user_data.deck_versions
for each row
execute function user_data.enforce_deck_version_ownership();

drop function if exists user_data.prevent_deck_card_version_reassignment();
create function user_data.prevent_deck_card_version_reassignment()
returns trigger
language plpgsql
set search_path = user_data, pg_catalog
as $$
begin
  if new.deck_version_id is distinct from old.deck_version_id then
    raise exception
      'Deck cards cannot be moved to another deck version.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists deck_cards_prevent_version_reassignment_trigger
  on user_data.deck_cards;
create trigger deck_cards_prevent_version_reassignment_trigger
before update of deck_version_id
on user_data.deck_cards
for each row
execute function user_data.prevent_deck_card_version_reassignment();
