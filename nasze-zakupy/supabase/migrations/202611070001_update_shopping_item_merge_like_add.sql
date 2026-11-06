begin;

-- Editing a product follows the same merge rule as adding one (202611060001):
--   * merge only into another UNPURCHASED row with the same name (case- and
--     whitespace-insensitive) AND the same unit, when both quantities are present
--     and the sum stays within the limit;
--   * purchased rows are never merge targets;
--   * every other case simply saves the edited row, so a product with the same
--     name elsewhere on the list no longer blocks the edit with
--     "cannot be safely merged".
-- This also re-applies the "unpurchased only" rule in case 202611050008 was not
-- applied to a database.

drop function if exists public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz);

create function public.update_shopping_item(
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
  normalized_unit text := nullif(pg_catalog.btrim(target_unit), '');
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

  if normalized_unit is not null
    and pg_catalog.char_length(normalized_unit) > 32
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

  -- Only a purchasable twin that can be summed safely is merged into.
  -- An item that is itself purchased is edited in place.
  if current_item.is_purchased = false then
    select shopping_item.*
      into matching_item
      from public.shopping_items as shopping_item
      where shopping_item.list_id = target_list_id
        and shopping_item.id <> target_item_id
        and shopping_item.deleted_at is null
        and shopping_item.is_purchased = false
        and shopping_item.quantity is not null
        and target_quantity is not null
        and shopping_item.unit is not distinct from normalized_unit
        and shopping_item.quantity + target_quantity <= 999999999.999
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
      update public.shopping_items as shopping_item
        set quantity = matching_item.quantity + target_quantity
        where shopping_item.id = matching_item.id;

      delete from public.shopping_items as shopping_item
        where shopping_item.id = target_item_id
          and shopping_item.list_id = target_list_id;

      return matching_item.id;
    end if;
  end if;

  update public.shopping_items as shopping_item
    set name = pg_catalog.btrim(target_name),
        quantity = target_quantity,
        unit = normalized_unit,
        category = target_category
    where shopping_item.id = target_item_id
      and shopping_item.list_id = target_list_id;

  return target_item_id;
end;
$$;

revoke all on function public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz)
  to authenticated;

commit;
