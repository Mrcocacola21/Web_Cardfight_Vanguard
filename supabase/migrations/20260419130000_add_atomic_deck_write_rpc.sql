create or replace function user_data.save_deck_aggregate(
  save_deck_id uuid default null,
  save_owner_profile_id uuid default null,
  save_format_id text default null,
  save_title text default null,
  save_description text default null,
  save_tags text[] default null,
  save_is_favorite boolean default null,
  save_visibility text default null,
  save_archived_at timestamptz default null,
  save_version_note text default null,
  save_cards jsonb default '[]'::jsonb
)
returns table (
  deck_id uuid,
  owner_profile_id uuid,
  format_id text,
  title text,
  description text,
  tags text[],
  is_favorite boolean,
  visibility text,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  current_version_id uuid,
  current_version_number integer,
  current_version_created_at timestamptz,
  current_version_note text,
  current_version_created_by_profile_id uuid
)
language plpgsql
security invoker
set search_path = user_data, pg_catalog
as $$
declare
  persisted_deck user_data.decks%rowtype;
  persisted_version user_data.deck_versions%rowtype;
  resolved_owner_profile_id uuid;
  next_version_number integer;
  resolved_cards jsonb := coalesce(save_cards, '[]'::jsonb);
begin
  resolved_owner_profile_id := user_data.current_profile_id();

  if resolved_owner_profile_id is null then
    raise insufficient_privilege
      using message = 'Deck writes require an authenticated profile.',
            detail = 'user_data.current_profile_id() returned null for this request.';
  end if;

  if save_owner_profile_id is distinct from resolved_owner_profile_id then
    raise insufficient_privilege
      using message = 'Deck writes must target the current profile.',
            detail = format(
              'Current profile %s cannot persist deck rows for %s.',
              resolved_owner_profile_id,
              save_owner_profile_id
            );
  end if;

  if jsonb_typeof(resolved_cards) is distinct from 'array' then
    raise exception
      using errcode = '22023',
            message = 'Deck cards payload must be a JSON array.';
  end if;

  if save_deck_id is null then
    insert into user_data.decks (
      owner_profile_id,
      format_id,
      title,
      description,
      tags,
      is_favorite,
      visibility,
      archived_at
    ) values (
      save_owner_profile_id,
      save_format_id,
      save_title,
      save_description,
      coalesce(save_tags, array[]::text[]),
      coalesce(save_is_favorite, false),
      coalesce(save_visibility, 'private'),
      save_archived_at
    )
    returning *
    into persisted_deck;
  else
    select *
    into persisted_deck
    from user_data.decks
    where id = save_deck_id
    for update;

    if not found then
      raise exception
        using errcode = 'P0002',
              message = 'Deck not found.',
              detail = format(
                'Deck %s could not be loaded for atomic save.',
                save_deck_id
              );
    end if;
  end if;

  select coalesce(max(deck_versions.version_number), 0) + 1
  into next_version_number
  from user_data.deck_versions
  where deck_versions.deck_id = persisted_deck.id;

  insert into user_data.deck_versions (
    deck_id,
    version_number,
    created_by_profile_id,
    version_note
  ) values (
    persisted_deck.id,
    next_version_number,
    save_owner_profile_id,
    save_version_note
  )
  returning *
  into persisted_version;

  if jsonb_array_length(resolved_cards) > 0 then
    insert into user_data.deck_cards (
      deck_version_id,
      section_key,
      card_entity_id,
      quantity
    )
    select
      persisted_version.id,
      card_row.section_key,
      card_row.card_entity_id,
      card_row.quantity
    from jsonb_to_recordset(resolved_cards) as card_row(
      section_key text,
      card_entity_id uuid,
      quantity smallint
    );
  end if;

  update user_data.decks
  set
    format_id = coalesce(save_format_id, persisted_deck.format_id),
    title = coalesce(save_title, persisted_deck.title),
    description = save_description,
    tags = coalesce(save_tags, persisted_deck.tags),
    is_favorite = coalesce(save_is_favorite, persisted_deck.is_favorite),
    visibility = coalesce(save_visibility, persisted_deck.visibility),
    archived_at = coalesce(save_archived_at, persisted_deck.archived_at),
    current_version_id = persisted_version.id,
    updated_at = clock_timestamp()
  where id = persisted_deck.id
  returning *
  into persisted_deck;

  return query
  select
    persisted_deck.id,
    persisted_deck.owner_profile_id,
    persisted_deck.format_id,
    persisted_deck.title,
    persisted_deck.description,
    persisted_deck.tags,
    persisted_deck.is_favorite,
    persisted_deck.visibility,
    persisted_deck.archived_at,
    persisted_deck.created_at,
    persisted_deck.updated_at,
    persisted_version.id,
    persisted_version.version_number,
    persisted_version.created_at,
    persisted_version.version_note,
    persisted_version.created_by_profile_id;
end;
$$;

revoke all
  on function user_data.save_deck_aggregate(
    uuid,
    uuid,
    text,
    text,
    text,
    text[],
    boolean,
    text,
    timestamptz,
    text,
    jsonb
  )
  from public;

grant execute
  on function user_data.save_deck_aggregate(
    uuid,
    uuid,
    text,
    text,
    text,
    text[],
    boolean,
    text,
    timestamptz,
    text,
    jsonb
  )
  to authenticated, service_role;
