begin;

alter table public.recipe_steps
  add column if not exists duration_minutes integer
  check (duration_minutes is null or duration_minutes >= 0);

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
      or (
        step.value ? 'duration_minutes'
        and pg_catalog.jsonb_typeof(step.value -> 'duration_minutes') <> 'null'
        and (
          pg_catalog.jsonb_typeof(step.value -> 'duration_minutes') <> 'number'
          or (step.value ->> 'duration_minutes') !~ '^[0-9]+$'
          or case
            when (step.value ->> 'duration_minutes') ~ '^[0-9]+$'
              then (step.value ->> 'duration_minutes')::numeric > 2147483647
            else false
          end
        )
      )
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

  insert into public.recipe_steps (recipe_id, text, sort_order, duration_minutes)
  select
    saved_recipe_id,
    pg_catalog.btrim(step.value ->> 'text'),
    (step.ordinality - 1)::integer,
    (step.value ->> 'duration_minutes')::integer
  from pg_catalog.jsonb_array_elements(target_steps) with ordinality as step(value, ordinality);

  return saved_recipe_id;
end;
$$;

create or replace function public.ensure_active_shopping_list(target_household_id uuid)
returns table (list_id uuid, list_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.household_members as membership
      where membership.household_id = target_household_id
        and membership.user_id = (select auth.uid())
    )
  then
    raise exception 'Household unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  if not exists (
    select 1
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = (select auth.uid())
  ) then
    raise exception 'Household unavailable.';
  end if;

  return query
    select shopping_list.id, shopping_list.name
    from public.shopping_lists as shopping_list
    where shopping_list.household_id = target_household_id
      and shopping_list.archived_at is null
    order by shopping_list.created_at, shopping_list.id
    limit 1;
end;
$$;

create or replace function public.create_household(target_name text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_membership_count bigint;
  created_household_id uuid;
  created_household_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 847201)
  );

  select pg_catalog.count(*)
    into current_membership_count
    from public.household_members as membership
    where membership.user_id = current_user_id;

  if current_membership_count >= 3 then
    raise exception 'Household limit reached.';
  end if;

  insert into public.households (name, owner_id)
    values (target_name, current_user_id)
    returning id, name
    into created_household_id, created_household_name;

  insert into public.shopping_lists (household_id, name, created_by)
    values (created_household_id, 'Zakupy', current_user_id);

  return query
    select created_household_id, created_household_name;
end;
$$;

create or replace function public.create_shopping_list(target_household_id uuid)
returns table (list_id uuid, list_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null
    or not exists (
      select 1
      from public.household_members as membership
      where membership.household_id = target_household_id
        and membership.user_id = current_user_id
    )
  then
    raise exception 'Household unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  if not exists (
    select 1
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = current_user_id
  ) then
    raise exception 'Household unavailable.';
  end if;

  return query
    select shopping_list.id, shopping_list.name
    from public.shopping_lists as shopping_list
    where shopping_list.household_id = target_household_id
      and shopping_list.archived_at is null
    order by shopping_list.created_at, shopping_list.id
    limit 1;

  if found then
    return;
  end if;

  insert into public.shopping_lists (household_id, name, created_by)
    values (target_household_id, 'Zakupy', current_user_id)
    returning id, name into list_id, list_name;
  return next;
end;
$$;

create or replace function public.delete_shopping_list(target_list_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select shopping_list.household_id
    into target_household_id
    from public.shopping_lists as shopping_list
    join public.household_members as membership
      on membership.household_id = shopping_list.household_id
    where shopping_list.id = target_list_id
      and membership.user_id = current_user_id;

  if target_household_id is null then
    raise exception 'Shopping list unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  delete from public.shopping_lists as shopping_list
    where shopping_list.id = target_list_id
      and shopping_list.household_id = target_household_id
      and exists (
        select 1
        from public.household_members as membership
        where membership.household_id = target_household_id
          and membership.user_id = current_user_id
      );

  if not found then
    raise exception 'Shopping list unavailable.';
  end if;

  return true;
end;
$$;

revoke all on function public.save_recipe_with_steps(uuid, uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_recipe_with_steps(uuid, uuid, text, text, jsonb, jsonb)
  to authenticated;

revoke all on function public.ensure_active_shopping_list(uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_active_shopping_list(uuid) to authenticated;

revoke all on function public.create_household(text) from public, anon, authenticated;
grant execute on function public.create_household(text) to authenticated;

revoke all on function public.create_shopping_list(uuid) from public, anon, authenticated;
grant execute on function public.create_shopping_list(uuid) to authenticated;

revoke all on function public.delete_shopping_list(uuid) from public, anon, authenticated;
grant execute on function public.delete_shopping_list(uuid) to authenticated;

commit;
