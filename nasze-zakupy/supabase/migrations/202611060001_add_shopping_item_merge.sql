begin;

-- Adding a product by hand follows the same rule as adding recipe ingredients:
--   * merge only into an unpurchased row with the same name (case- and
--     whitespace-insensitive) AND the same unit, when both quantities are present
--     and the sum stays within the limit;
--   * every other case (different unit, purchased row, missing quantity,
--     overflow) inserts a separate row.
-- Returns the id of the row that holds the product and whether it was merged.

create or replace function public.add_shopping_item(
  target_list_id uuid,
  target_name text,
  target_quantity numeric,
  target_unit text,
  target_category text
)
returns table (item_id uuid, merged boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_household_id uuid;
  locked_list_id uuid;
  normalized_unit text := nullif(pg_catalog.btrim(target_unit), '');
  existing_item public.shopping_items%rowtype;
  new_item_id uuid;
begin
  if current_user_id is null then
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

  -- Same lock as recipe adds and item edits, so two quick adds cannot both insert.
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

  select shopping_item.*
    into existing_item
    from public.shopping_items as shopping_item
    where shopping_item.list_id = target_list_id
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
      set quantity = existing_item.quantity + target_quantity
      where shopping_item.id = existing_item.id;
    return query select existing_item.id, true;
    return;
  end if;

  insert into public.shopping_items (list_id, name, quantity, unit, category, created_by)
    values (
      target_list_id,
      pg_catalog.btrim(target_name),
      target_quantity,
      normalized_unit,
      target_category,
      current_user_id
    )
    returning id into new_item_id;

  return query select new_item_id, false;
end;
$$;

revoke all on function public.add_shopping_item(uuid, text, numeric, text, text)
  from public, anon, authenticated;
grant execute on function public.add_shopping_item(uuid, text, numeric, text, text)
  to authenticated;

commit;
