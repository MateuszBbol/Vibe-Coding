begin;

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  text text not null,
  sort_order integer not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint recipe_steps_text_length check (char_length(btrim(text)) between 1 and 500),
  constraint recipe_steps_sort_order_nonnegative check (sort_order >= 0),
  constraint recipe_steps_recipe_sort_order_unique unique (recipe_id, sort_order)
);

create index if not exists recipe_steps_recipe_id_sort_order_idx
  on public.recipe_steps (recipe_id, sort_order);

alter table public.recipe_steps enable row level security;
revoke all on public.recipe_steps from anon, authenticated;
grant select on public.recipe_steps to authenticated;

drop policy if exists "Household members can read recipe steps" on public.recipe_steps;
create policy "Household members can read recipe steps"
  on public.recipe_steps for select to authenticated
  using (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_steps.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );

create or replace function public.save_recipe_with_steps(
  target_household_id uuid,
  target_recipe_id uuid,
  target_name text,
  target_description text,
  target_items jsonb,
  target_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_recipe_id uuid;
begin
  if target_steps is null or pg_catalog.jsonb_typeof(target_steps) <> 'array' then
    raise exception 'Recipe preparation steps are invalid.';
  end if;
  if pg_catalog.jsonb_array_length(target_steps) > 50 then
    raise exception 'A recipe can have no more than 50 preparation steps.';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(target_steps) as step(value)
    where pg_catalog.jsonb_typeof(step.value) <> 'object'
      or pg_catalog.jsonb_typeof(step.value -> 'text') <> 'string'
      or nullif(pg_catalog.btrim(step.value ->> 'text'), '') is null
      or pg_catalog.char_length(pg_catalog.btrim(step.value ->> 'text')) > 500
  ) then
    raise exception 'Recipe preparation steps are invalid.';
  end if;

  saved_recipe_id := public.save_recipe(
    target_household_id,
    target_recipe_id,
    target_name,
    target_description,
    target_items
  );

  delete from public.recipe_steps as recipe_step
    where recipe_step.recipe_id = saved_recipe_id;

  insert into public.recipe_steps (recipe_id, text, sort_order)
  select
    saved_recipe_id,
    pg_catalog.btrim(step.value ->> 'text'),
    (step.ordinality - 1)::integer
  from pg_catalog.jsonb_array_elements(target_steps) with ordinality as step(value, ordinality);

  return saved_recipe_id;
end;
$$;

create or replace function public.add_recipe_to_active_shopping_list(target_recipe_id uuid)
returns table (items_added integer, list_id uuid, list_name text)
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

    if not found then
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
    elsif existing_item.quantity is not null
      and recipe_item.quantity is not null
      and existing_item.unit is not distinct from recipe_item.unit
      and existing_item.quantity + recipe_item.quantity <= 999999999.999
    then
      update public.shopping_items as shopping_item
        set quantity = existing_item.quantity + recipe_item.quantity
        where shopping_item.id = existing_item.id;
    end if;
  end loop;

  if processed_item_count = 0 then
    raise exception 'Recipe has no ingredients.';
  end if;

  return query
    select inserted_item_count, target_list_id, target_list_name;
end;
$$;

revoke all on function public.save_recipe_with_steps(uuid, uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_recipe_with_steps(uuid, uuid, text, text, jsonb, jsonb)
  to authenticated;

revoke all on function public.add_recipe_to_active_shopping_list(uuid)
  from public, anon, authenticated;
grant execute on function public.add_recipe_to_active_shopping_list(uuid)
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recipe_steps'
  ) then
    alter publication supabase_realtime add table public.recipe_steps;
  end if;
end;
$$;

commit;
