begin;

-- Adding an ingredient to the active list never drops it silently any more.
-- Rules:
--   * merge only into an unpurchased row with the same name AND the same unit,
--     when both quantities are present and the sum stays within the limit;
--   * every other case (different unit, purchased row, missing quantity,
--     overflow) inserts a separate row.
-- Returns how many rows were inserted and how many were merged.

drop function if exists public.add_recipe_to_active_shopping_list(uuid);

create function public.add_recipe_to_active_shopping_list(target_recipe_id uuid)
returns table (items_added integer, items_merged integer, list_id uuid, list_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_household_id uuid;
  locked_household_id uuid;
  target_list_id uuid;
  target_list_name text;
  inserted_item_count integer := 0;
  merged_item_count integer := 0;
  processed_item_count integer := 0;
  recipe_item record;
  existing_item public.shopping_items%rowtype;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select recipe.household_id
    into target_household_id
    from public.recipes as recipe
    where recipe.id = target_recipe_id;

  if target_household_id is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Recipe unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  select recipe.household_id
    into locked_household_id
    from public.recipes as recipe
    where recipe.id = target_recipe_id
    for share of recipe;

  if locked_household_id is distinct from target_household_id
    or not public.is_household_member(locked_household_id)
  then
    raise exception 'Recipe unavailable.';
  end if;

  select active_list.list_id, active_list.list_name
    into target_list_id, target_list_name
    from public.ensure_active_shopping_list(target_household_id) as active_list;

  if target_list_id is null then
    raise exception 'Active shopping list unavailable.';
  end if;

  for recipe_item in
    select item.name, item.quantity, item.unit, item.category
    from public.recipe_items as item
    where item.recipe_id = target_recipe_id
    order by item.sort_order, item.id
  loop
    processed_item_count := processed_item_count + 1;

    select shopping_item.*
      into existing_item
      from public.shopping_items as shopping_item
      where shopping_item.list_id = target_list_id
        and shopping_item.deleted_at is null
        and shopping_item.is_purchased = false
        and shopping_item.quantity is not null
        and recipe_item.quantity is not null
        and shopping_item.unit is not distinct from recipe_item.unit
        and shopping_item.quantity + recipe_item.quantity <= 999999999.999
        and pg_catalog.lower(
          pg_catalog.regexp_replace(
            pg_catalog.btrim(shopping_item.name),
            '[[:space:]]+',
            ' ',
            'g'
          )
        ) = pg_catalog.lower(
          pg_catalog.regexp_replace(
            pg_catalog.btrim(recipe_item.name),
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
        set quantity = existing_item.quantity + recipe_item.quantity
        where shopping_item.id = existing_item.id;
      merged_item_count := merged_item_count + 1;
    else
      insert into public.shopping_items (
        list_id, name, quantity, unit, category, created_by
      )
      values (
        target_list_id,
        recipe_item.name,
        recipe_item.quantity,
        recipe_item.unit,
        recipe_item.category,
        current_user_id
      );
      inserted_item_count := inserted_item_count + 1;
    end if;
  end loop;

  if processed_item_count = 0 then
    raise exception 'Recipe has no ingredients.';
  end if;

  return query
    select inserted_item_count, merged_item_count, target_list_id, target_list_name;
end;
$$;

revoke all on function public.add_recipe_to_active_shopping_list(uuid)
  from public, anon, authenticated;
grant execute on function public.add_recipe_to_active_shopping_list(uuid)
  to authenticated;

commit;
