drop function if exists social.enforce_match_participant_deck_ownership();
create function social.enforce_match_participant_deck_ownership()
returns trigger
language plpgsql
set search_path = social, user_data, pg_catalog
as $$
declare
  match_owner_profile_id uuid;
  deck_owner_profile_id uuid;
begin
  if new.deck_version_id is null then
    return new;
  end if;

  select matches.recorded_by_profile_id
  into match_owner_profile_id
  from social.matches
  where matches.id = new.match_id;

  if match_owner_profile_id is null then
    return new;
  end if;

  select decks.owner_profile_id
  into deck_owner_profile_id
  from user_data.deck_versions
  join user_data.decks
    on decks.id = deck_versions.deck_id
  where deck_versions.id = new.deck_version_id;

  if deck_owner_profile_id is null then
    return new;
  end if;

  if deck_owner_profile_id <> match_owner_profile_id then
    raise exception
      'Match participants can only reference deck versions owned by the match owner.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists match_participants_enforce_deck_ownership_trigger
  on social.match_participants;
create trigger match_participants_enforce_deck_ownership_trigger
before insert or update of match_id, deck_version_id
on social.match_participants
for each row
execute function social.enforce_match_participant_deck_ownership();
