begin;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint recipes_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint recipes_description_length check (
    description is null or char_length(description) <= 2000
  )
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  quantity numeric(12, 3),
  unit text,
  category text not null default 'other',
  sort_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  constraint recipe_items_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint recipe_items_quantity_positive check (quantity is null or quantity > 0),
  constraint recipe_items_unit check (
    unit is null or unit in ('szt.', 'kg', 'g', 'l', 'ml', 'opak.')
  ),
  constraint recipe_items_category check (
    category in (
      'produce', 'bakery', 'dairy', 'meat_fish', 'groceries', 'frozen',
      'snacks', 'drinks', 'hygiene', 'home', 'other'
    )
  ),
  constraint recipe_items_sort_order_nonnegative check (sort_order >= 0)
);

create index recipes_household_id_name_idx on public.recipes (household_id, name);
create index recipe_items_recipe_id_sort_order_idx
  on public.recipe_items (recipe_id, sort_order);

create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;

revoke all on public.recipes, public.recipe_items from anon, authenticated;
grant select, delete on public.recipes to authenticated;
grant select on public.recipe_items to authenticated;

create policy "Household members can read recipes"
  on public.recipes for select to authenticated
  using (public.is_household_member(household_id));
create policy "Household members can create recipes"
  on public.recipes for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = (select auth.uid())
  );
create policy "Household members can update recipes"
  on public.recipes for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "Household members can delete recipes"
  on public.recipes for delete to authenticated
  using (public.is_household_member(household_id));

create policy "Household members can read recipe items"
  on public.recipe_items for select to authenticated
  using (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );
create policy "Household members can create recipe items"
  on public.recipe_items for insert to authenticated
  with check (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );
create policy "Household members can update recipe items"
  on public.recipe_items for update to authenticated
  using (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );
create policy "Household members can delete recipe items"
  on public.recipe_items for delete to authenticated
  using (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );

create or replace function public.save_recipe(
  target_household_id uuid,
  target_recipe_id uuid,
  target_name text,
  target_description text,
  target_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_household_id uuid;
  saved_recipe_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_household_id is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Household unavailable.';
  end if;

  if target_name is null
    or pg_catalog.char_length(pg_catalog.btrim(target_name)) not between 1 and 120
  then
    raise exception 'Recipe name is invalid.';
  end if;

  if target_description is not null
    and pg_catalog.char_length(pg_catalog.btrim(target_description)) > 2000
  then
    raise exception 'Recipe description is too long.';
  end if;

  if target_items is null or pg_catalog.jsonb_typeof(target_items) <> 'array' then
    raise exception 'Recipe ingredients are invalid.';
  end if;
  if pg_catalog.jsonb_array_length(target_items) not between 1 and 100 then
    raise exception 'A recipe must have between 1 and 100 ingredients.';
  end if;

  if target_recipe_id is null then
    insert into public.recipes (household_id, name, description, created_by)
    values (
      target_household_id,
      pg_catalog.btrim(target_name),
      nullif(pg_catalog.btrim(target_description), ''),
      current_user_id
    )
    returning id into saved_recipe_id;
  else
    select recipe.household_id
      into existing_household_id
      from public.recipes as recipe
      where recipe.id = target_recipe_id
      for update of recipe;

    if existing_household_id is distinct from target_household_id
      or not public.is_household_member(existing_household_id)
    then
      raise exception 'Recipe unavailable.';
    end if;

    update public.recipes as recipe
      set name = pg_catalog.btrim(target_name),
          description = nullif(pg_catalog.btrim(target_description), '')
      where recipe.id = target_recipe_id;
    saved_recipe_id := target_recipe_id;

    delete from public.recipe_items as recipe_item
      where recipe_item.recipe_id = saved_recipe_id;
  end if;

  insert into public.recipe_items (
    recipe_id, name, quantity, unit, category, sort_order
  )
  select
    saved_recipe_id,
    pg_catalog.btrim(item.name),
    item.quantity,
    item.unit,
    item.category,
    item.sort_order
  from pg_catalog.jsonb_to_recordset(target_items) as item(
    name text,
    quantity numeric,
    unit text,
    category text,
    sort_order integer
  );

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
  inserted_item_count integer;
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

  insert into public.shopping_items (
    list_id, name, quantity, unit, category, created_by
  )
  select
    target_list_id,
    recipe_item.name,
    recipe_item.quantity,
    recipe_item.unit,
    recipe_item.category,
    current_user_id
  from public.recipe_items as recipe_item
  where recipe_item.recipe_id = target_recipe_id
  order by recipe_item.sort_order, recipe_item.id;

  get diagnostics inserted_item_count = row_count;
  if inserted_item_count = 0 then
    raise exception 'Recipe has no ingredients.';
  end if;

  return query
    select inserted_item_count, target_list_id, target_list_name;
end;
$$;

revoke all on function public.save_recipe(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.add_recipe_to_active_shopping_list(uuid)
  from public, anon, authenticated;
grant execute on function public.save_recipe(uuid, uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.add_recipe_to_active_shopping_list(uuid)
  to authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['recipes', 'recipe_items'] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute pg_catalog.format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end;
$$;

commit;
