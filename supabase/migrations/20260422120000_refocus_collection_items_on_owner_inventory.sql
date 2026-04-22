alter table user_data.collection_items
  add column if not exists owner_profile_id uuid
    references user_data.profiles (id)
    on delete restrict;

update user_data.collection_items
set owner_profile_id = collections.owner_profile_id
from user_data.collections
where collections.id = collection_items.collection_id
  and collection_items.owner_profile_id is null;

do $$
begin
  if exists (
    select 1
    from user_data.collection_items
    where owner_profile_id is null
  ) then
    raise exception
      'Existing collection_items rows are missing owner_profile_id backfill.'
      using errcode = '23514';
  end if;
end;
$$;

alter table user_data.collection_items
  alter column owner_profile_id set not null;

drop policy if exists collection_items_owner_select on user_data.collection_items;
drop policy if exists collection_items_owner_insert on user_data.collection_items;
drop policy if exists collection_items_owner_update on user_data.collection_items;
drop policy if exists collection_items_owner_delete on user_data.collection_items;

alter table user_data.collection_items
  drop constraint if exists collection_items_collection_id_card_printing_id_key;

alter table user_data.collection_items
  drop constraint if exists collection_items_collection_id_fkey;

alter table user_data.collection_items
  drop column if exists collection_id;

alter table user_data.collection_items
  drop column if exists notes;

alter table user_data.collection_items
  add constraint collection_items_owner_profile_id_card_printing_id_key
    unique (owner_profile_id, card_printing_id);

create index if not exists collection_items_owner_idx
  on user_data.collection_items (owner_profile_id, updated_at desc);

alter table user_data.collections force row level security;
alter table user_data.collection_items force row level security;

create policy collection_items_owner_select
  on user_data.collection_items
  for select
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

create policy collection_items_owner_insert
  on user_data.collection_items
  for insert
  to authenticated
  with check (owner_profile_id = user_data.current_profile_id());

create policy collection_items_owner_update
  on user_data.collection_items
  for update
  to authenticated
  using (owner_profile_id = user_data.current_profile_id())
  with check (owner_profile_id = user_data.current_profile_id());

create policy collection_items_owner_delete
  on user_data.collection_items
  for delete
  to authenticated
  using (owner_profile_id = user_data.current_profile_id());

drop function if exists user_data.prevent_collection_item_identity_reassignment();
create function user_data.prevent_collection_item_identity_reassignment()
returns trigger
language plpgsql
set search_path = user_data, pg_catalog
as $$
begin
  if new.owner_profile_id is distinct from old.owner_profile_id then
    raise exception
      'Collection item ownership cannot be reassigned after creation.'
      using errcode = '23514';
  end if;

  if new.card_printing_id is distinct from old.card_printing_id then
    raise exception
      'Collection items cannot be reassigned to a different printing.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists collection_items_prevent_identity_reassignment_trigger
  on user_data.collection_items;
create trigger collection_items_prevent_identity_reassignment_trigger
before update of owner_profile_id, card_printing_id
on user_data.collection_items
for each row
execute function user_data.prevent_collection_item_identity_reassignment();

drop function if exists user_data.change_collection_item_quantity(uuid, uuid, integer);
create function user_data.change_collection_item_quantity(
  change_owner_profile_id uuid,
  change_card_printing_id uuid,
  change_quantity_delta integer
)
returns setof user_data.collection_items
language plpgsql
security invoker
set search_path = user_data, pg_catalog
as $$
declare
  existing_item user_data.collection_items%rowtype;
  next_quantity integer;
  persisted_item user_data.collection_items%rowtype;
begin
  if change_quantity_delta = 0 then
    raise exception
      'Collection quantity delta must be non-zero.'
      using errcode = '22023';
  end if;

  if change_owner_profile_id is distinct from user_data.current_profile_id() then
    raise exception
      'Collection mutations must target the current owner profile.'
      using errcode = '42501';
  end if;

  if change_quantity_delta > 0 then
    insert into user_data.collection_items (
      owner_profile_id,
      card_printing_id,
      quantity
    ) values (
      change_owner_profile_id,
      change_card_printing_id,
      change_quantity_delta
    )
    on conflict (owner_profile_id, card_printing_id)
    do update
      set quantity = user_data.collection_items.quantity + excluded.quantity,
          updated_at = now()
    returning *
    into persisted_item;

    return next persisted_item;
    return;
  end if;

  select *
  into existing_item
  from user_data.collection_items
  where owner_profile_id = change_owner_profile_id
    and card_printing_id = change_card_printing_id
  for update;

  if not found then
    raise exception
      'Collection item is not available for decrement.'
      using errcode = 'P0002';
  end if;

  next_quantity := existing_item.quantity + change_quantity_delta;

  if next_quantity < 0 then
    raise exception
      'Collection quantity cannot become negative.'
      using errcode = '23514';
  end if;

  if next_quantity = 0 then
    delete from user_data.collection_items
    where id = existing_item.id;

    return;
  end if;

  update user_data.collection_items
  set quantity = next_quantity,
      updated_at = now()
  where id = existing_item.id
  returning *
  into persisted_item;

  return next persisted_item;
end;
$$;

revoke all on function user_data.change_collection_item_quantity(uuid, uuid, integer)
  from public;
grant execute on function user_data.change_collection_item_quantity(uuid, uuid, integer)
  to authenticated, service_role;

drop function if exists user_data.set_collection_item_quantity(uuid, uuid, integer);
create function user_data.set_collection_item_quantity(
  set_owner_profile_id uuid,
  set_card_printing_id uuid,
  set_quantity integer
)
returns setof user_data.collection_items
language plpgsql
security invoker
set search_path = user_data, pg_catalog
as $$
declare
  persisted_item user_data.collection_items%rowtype;
begin
  if set_quantity < 0 then
    raise exception
      'Collection quantity cannot be negative.'
      using errcode = '22023';
  end if;

  if set_owner_profile_id is distinct from user_data.current_profile_id() then
    raise exception
      'Collection mutations must target the current owner profile.'
      using errcode = '42501';
  end if;

  if set_quantity = 0 then
    delete from user_data.collection_items
    where owner_profile_id = set_owner_profile_id
      and card_printing_id = set_card_printing_id;

    return;
  end if;

  insert into user_data.collection_items (
    owner_profile_id,
    card_printing_id,
    quantity
  ) values (
    set_owner_profile_id,
    set_card_printing_id,
    set_quantity
  )
  on conflict (owner_profile_id, card_printing_id)
  do update
    set quantity = excluded.quantity,
        updated_at = now()
  returning *
  into persisted_item;

  return next persisted_item;
end;
$$;

revoke all on function user_data.set_collection_item_quantity(uuid, uuid, integer)
  from public;
grant execute on function user_data.set_collection_item_quantity(uuid, uuid, integer)
  to authenticated, service_role;
