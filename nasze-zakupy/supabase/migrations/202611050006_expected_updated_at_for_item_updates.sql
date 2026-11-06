begin;

-- Optimistic concurrency: the client sends the updated_at it last saw.
-- If the row changed since then, the write is rejected instead of silently
-- overwriting the other member's change. Parameter defaults to null so a
-- client that has not been updated yet keeps working during rollout.

drop function if exists public.update_shopping_item(uuid, uuid, text, numeric, text, text);

create or replace function public.update_shopping_item(
  target_list_id uuid,
  target_item_id uuid,
  target_name text,
  target_quantity numeric,
  target_unit text,
  target_category text,
  target_expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid;
  locked_list_id uuid;
  current_item public.shopping_items%rowtype;
  matching_item public.shopping_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select shopping_list.household_id
    into target_household_id
    from public.shopping_lists as shopping_list
    where shopping_list.id = target_list_id;

  if target_household_id is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Shopping list unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  select shopping_list.id
    into locked_list_id
    from public.shopping_lists as shopping_list
    where shopping_list.id = target_list_id
      and public.is_household_member(shopping_list.household_id)
    for update;

  if locked_list_id is null then
    raise exception 'Shopping list unavailable.';
  end if;

  if target_name is null
    or pg_catalog.char_length(pg_catalog.btrim(target_name)) not between 1 and 120
  then
    raise exception 'Product name must contain between 1 and 120 characters.';
  end if;

  if target_quantity is not null
    and (target_quantity <= 0 or target_quantity > 999999999.999)
  then
    raise exception 'Product quantity is invalid.';
  end if;

  if target_unit is not null
    and pg_catalog.char_length(pg_catalog.btrim(target_unit)) not between 1 and 32
  then
    raise exception 'Product unit is invalid.';
  end if;

  select shopping_item.*
    into current_item
    from public.shopping_items as shopping_item
    where shopping_item.id = target_item_id
      and shopping_item.list_id = target_list_id
      and shopping_item.deleted_at is null
    for update;

  if not found then
    raise exception 'Product not found on this shopping list.';
  end if;

  if target_expected_updated_at is not null
    and current_item.updated_at is distinct from target_expected_updated_at
  then
    raise exception 'Shopping item was changed by another user. Refresh and try again.';
  end if;

  select shopping_item.*
    into matching_item
    from public.shopping_items as shopping_item
    where shopping_item.list_id = target_list_id
      and shopping_item.id <> target_item_id
      and shopping_item.deleted_at is null
      and pg_catalog.lower(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(shopping_item.name),
          '[[:space:]]+',
          ' ',
          'g'
        )
      ) = pg_catalog.lower(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(target_name),
          '[[:space:]]+',
          ' ',
          'g'
        )
      )
    order by shopping_item.created_at, shopping_item.id
    limit 1
    for update of shopping_item;

  if found then
    if matching_item.quantity is null
      or target_quantity is null
      or matching_item.unit is distinct from target_unit
      or matching_item.quantity + target_quantity > 999999999.999
    then
      raise exception 'A product with this name already exists and cannot be safely merged.';
    end if;

    update public.shopping_items as shopping_item
      set quantity = matching_item.quantity + target_quantity
      where shopping_item.id = matching_item.id;

    delete from public.shopping_items as shopping_item
      where shopping_item.id = target_item_id
        and shopping_item.list_id = target_list_id;

    return matching_item.id;
  end if;

  update public.shopping_items as shopping_item
    set name = pg_catalog.btrim(target_name),
        quantity = target_quantity,
        unit = nullif(pg_catalog.btrim(target_unit), ''),
        category = target_category
    where shopping_item.id = target_item_id
      and shopping_item.list_id = target_list_id;

  return target_item_id;
end;
$$;

revoke all on function public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz)
  from public, anon;
grant execute on function public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz)
  to authenticated;

drop function if exists public.update_todo_item(uuid, uuid, text, date, boolean, uuid[]);

create or replace function public.update_todo_item(
  target_household_id uuid,
  target_item_id uuid,
  target_title text,
  target_due_date date,
  target_completed boolean,
  target_user_ids uuid[],
  target_expected_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_household_id uuid;
  current_updated_at timestamptz;
begin
  if auth.uid() is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Household unavailable.';
  end if;

  if target_title is null
    or pg_catalog.char_length(pg_catalog.btrim(target_title)) not between 1 and 200
  then
    raise exception 'Task title must contain between 1 and 200 characters.';
  end if;

  select item.household_id, item.updated_at
  into actual_household_id, current_updated_at
  from public.todo_items as item
  where item.id = target_item_id
  for update;

  if actual_household_id is distinct from target_household_id then
    raise exception 'Task unavailable.';
  end if;

  if target_expected_updated_at is not null
    and current_updated_at is distinct from target_expected_updated_at
  then
    raise exception 'Task was changed by another user. Refresh and try again.';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(coalesce(target_user_ids, '{}'::uuid[])) as requested(user_id)
    where not exists (
      select 1
      from public.household_members as member
      where member.household_id = target_household_id
        and member.user_id = requested.user_id
    )
  ) then
    raise exception 'An assigned user is not a member of this household.';
  end if;

  update public.todo_items
  set title = pg_catalog.btrim(target_title),
      due_date = target_due_date,
      completed = target_completed
  where id = target_item_id
    and household_id = target_household_id;

  delete from public.todo_item_assignees
  where household_id = target_household_id
    and todo_item_id = target_item_id;

  insert into public.todo_item_assignees (household_id, todo_item_id, user_id)
  select target_household_id, target_item_id, requested.user_id
  from (
    select distinct pg_catalog.unnest(coalesce(target_user_ids, '{}'::uuid[])) as user_id
  ) as requested
  on conflict (todo_item_id, user_id) do nothing;
end;
$$;

revoke all on function public.update_todo_item(uuid, uuid, text, date, boolean, uuid[], timestamptz)
  from public, anon;
grant execute on function public.update_todo_item(uuid, uuid, text, date, boolean, uuid[], timestamptz)
  to authenticated;

commit;
