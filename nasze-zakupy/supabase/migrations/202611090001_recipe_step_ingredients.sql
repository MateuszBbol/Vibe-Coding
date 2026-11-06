begin;

-- A preparation step can optionally list some of the recipe's ingredients.
-- Steps and ingredients are rewritten together on every save and an ingredient's
-- sort_order is its position in the saved list, so a step stores those positions.

alter table public.recipe_steps
  add column if not exists ingredient_sort_orders integer[] not null default '{}';

alter table public.recipe_steps
  drop constraint if exists recipe_steps_ingredient_sort_orders_valid;
alter table public.recipe_steps
  add constraint recipe_steps_ingredient_sort_orders_valid
  check (pg_catalog.cardinality(ingredient_sort_orders) <= 100);

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
  item_count integer :=
    case
      when pg_catalog.jsonb_typeof(target_items) = 'array'
        then pg_catalog.jsonb_array_length(target_items)
      else 0
    end;
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
      -- Optional ingredients of the step: positions in target_items.
      or (
        step.value ? 'ingredient_indexes'
        and pg_catalog.jsonb_typeof(step.value -> 'ingredient_indexes') <> 'null'
        and (
          pg_catalog.jsonb_typeof(step.value -> 'ingredient_indexes') <> 'array'
          or pg_catalog.jsonb_array_length(step.value -> 'ingredient_indexes') > 100
          or exists (
            select 1
            from pg_catalog.jsonb_array_elements(step.value -> 'ingredient_indexes') as idx(value)
            where pg_catalog.jsonb_typeof(idx.value) <> 'number'
              or (idx.value #>> '{}') !~ '^[0-9]+$'
              or case
                when (idx.value #>> '{}') ~ '^[0-9]+$'
                  then (idx.value #>> '{}')::numeric >= item_count
                else false
              end
          )
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

  insert into public.recipe_steps (
    recipe_id, text, sort_order, duration_minutes, ingredient_sort_orders
  )
  select
    saved_recipe_id,
    pg_catalog.btrim(step.value ->> 'text'),
    (step.ordinality - 1)::integer,
    (step.value ->> 'duration_minutes')::integer,
    coalesce(
      (
        select pg_catalog.array_agg(distinct (idx.value #>> '{}')::integer
                                    order by (idx.value #>> '{}')::integer)
        from pg_catalog.jsonb_array_elements(
          case
            when pg_catalog.jsonb_typeof(step.value -> 'ingredient_indexes') = 'array'
              then step.value -> 'ingredient_indexes'
            else '[]'::jsonb
          end
        ) as idx(value)
      ),
      '{}'::integer[]
    )
  from pg_catalog.jsonb_array_elements(target_steps) with ordinality as step(value, ordinality);

  return saved_recipe_id;
end;
$$;

revoke all on function public.save_recipe_with_steps(uuid, uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_recipe_with_steps(uuid, uuid, text, text, jsonb, jsonb)
  to authenticated;

commit;
