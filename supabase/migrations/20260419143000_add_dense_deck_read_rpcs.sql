create or replace function user_data.list_deck_summaries(
  read_owner_profile_id uuid
)
returns table (
  deck_id uuid,
  owner_profile_id uuid,
  title text,
  description text,
  tags text[],
  is_favorite boolean,
  visibility text,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  format_id text,
  format_display_name text,
  format_description text,
  current_version_id uuid,
  current_version_number integer,
  main_count integer,
  ride_count integer,
  g_count integer
)
language sql
stable
security invoker
set search_path = user_data, catalog, legality, pg_catalog
as $$
  select
    decks.id as deck_id,
    decks.owner_profile_id,
    decks.title,
    decks.description,
    decks.tags,
    decks.is_favorite,
    decks.visibility,
    decks.archived_at,
    decks.created_at,
    decks.updated_at,
    decks.format_id,
    formats.display_name as format_display_name,
    formats.description as format_description,
    decks.current_version_id,
    current_version.version_number as current_version_number,
    coalesce(section_counts.main_count, 0)::integer as main_count,
    coalesce(section_counts.ride_count, 0)::integer as ride_count,
    coalesce(section_counts.g_count, 0)::integer as g_count
  from user_data.decks
  left join legality.formats
    on formats.id = decks.format_id
  left join user_data.deck_versions as current_version
    on current_version.id = decks.current_version_id
   and current_version.deck_id = decks.id
  left join lateral (
    select
      coalesce(
        sum(deck_cards.quantity) filter (where deck_cards.section_key = 'main'),
        0
      )::integer as main_count,
      coalesce(
        sum(deck_cards.quantity) filter (where deck_cards.section_key = 'ride'),
        0
      )::integer as ride_count,
      coalesce(
        sum(deck_cards.quantity) filter (where deck_cards.section_key = 'g'),
        0
      )::integer as g_count
    from user_data.deck_cards
    where deck_cards.deck_version_id = current_version.id
  ) as section_counts on true
  where decks.owner_profile_id = read_owner_profile_id
  order by decks.updated_at desc;
$$;

revoke all
  on function user_data.list_deck_summaries(uuid)
  from public;

grant execute
  on function user_data.list_deck_summaries(uuid)
  to authenticated, service_role;

create or replace function user_data.get_deck_detail_aggregate(
  read_deck_id uuid
)
returns table (
  deck_id uuid,
  owner_profile_id uuid,
  title text,
  description text,
  tags text[],
  is_favorite boolean,
  visibility text,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  format_id text,
  format_display_name text,
  format_description text,
  current_version_id uuid,
  current_version_number integer,
  current_version_created_by_profile_id uuid,
  current_version_note text,
  current_version_created_at timestamptz,
  current_version_cards jsonb,
  has_missing_card_entity boolean
)
language sql
stable
security invoker
set search_path = user_data, catalog, legality, pg_catalog
as $$
  select
    decks.id as deck_id,
    decks.owner_profile_id,
    decks.title,
    decks.description,
    decks.tags,
    decks.is_favorite,
    decks.visibility,
    decks.archived_at,
    decks.created_at,
    decks.updated_at,
    decks.format_id,
    formats.display_name as format_display_name,
    formats.description as format_description,
    decks.current_version_id,
    current_version.version_number as current_version_number,
    current_version.created_by_profile_id as current_version_created_by_profile_id,
    current_version.version_note as current_version_note,
    current_version.created_at as current_version_created_at,
    coalesce(card_payload.cards, '[]'::jsonb) as current_version_cards,
    coalesce(card_payload.has_missing_card_entity, false) as has_missing_card_entity
  from user_data.decks
  left join legality.formats
    on formats.id = decks.format_id
  left join user_data.deck_versions as current_version
    on current_version.id = decks.current_version_id
   and current_version.deck_id = decks.id
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'sectionKey', deck_cards.section_key,
          'cardEntityId', deck_cards.card_entity_id,
          'canonicalKey', card_entities.canonical_key,
          'name', card_entities.name,
          'grade', card_entities.grade,
          'cardType', card_entities.card_type,
          'triggerType', card_entities.trigger_type,
          'quantity', deck_cards.quantity
        )
        order by
          case deck_cards.section_key
            when 'main' then 0
            when 'ride' then 1
            when 'g' then 2
            else 3
          end,
          coalesce(card_entities.grade, 999),
          coalesce(card_entities.name, ''),
          deck_cards.card_entity_id
      ) filter (where card_entities.id is not null) as cards,
      coalesce(bool_or(card_entities.id is null), false) as has_missing_card_entity
    from user_data.deck_cards
    left join catalog.card_entities
      on card_entities.id = deck_cards.card_entity_id
    where deck_cards.deck_version_id = current_version.id
  ) as card_payload on true
  where decks.id = read_deck_id;
$$;

revoke all
  on function user_data.get_deck_detail_aggregate(uuid)
  from public;

grant execute
  on function user_data.get_deck_detail_aggregate(uuid)
  to authenticated, service_role;
