const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202610280006_recipes.sql'),
  'utf8',
).toLowerCase();
const schema = migration.replace(/\s+/g, '');
const stepsAndDeduplication = readFileSync(
  resolve(__dirname, '../migrations/202611050001_recipe_steps_and_deduplicate_shopping_items.sql'),
  'utf8',
).toLowerCase();
const stepsSchema = stepsAndDeduplication.replace(/\s+/g, '');

describe('recipes migration security and atomic operation contract', () => {
  it('creates household-scoped recipe tables with cascading foreign keys', () => {
    expect(schema).toContain(
      'household_iduuidnotnullreferencespublic.households(id)ondeletecascade',
    );
    expect(schema).toContain('recipe_iduuidnotnullreferencespublic.recipes(id)ondeletecascade');
    expect(migration).toContain('create table public.recipes');
    expect(migration).toContain('create table public.recipe_items');
  });

  it('enables RLS and limits read/write policy scope to household members', () => {
    expect(migration).toContain('alter table public.recipes enable row level security');
    expect(migration).toContain('alter table public.recipe_items enable row level security');
    expect(migration).toContain('public.is_household_member(household_id)');
    expect(migration).toContain('public.is_household_member(recipe.household_id)');
    expect(migration).toContain('created_by = (select auth.uid())');
  });

  it('restricts recipe mutations and list insertion to authenticated RPCs', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('create or replace function public.save_recipe(');
    expect(migration).toContain(
      'create or replace function public.add_recipe_to_active_shopping_list(target_recipe_id uuid)',
    );
    expect(migration).toContain(
      'revoke all on function public.save_recipe(uuid, uuid, text, text, jsonb)',
    );
    expect(migration).toContain(
      'grant execute on function public.save_recipe(uuid, uuid, text, text, jsonb)',
    );
    expect(migration).toContain(
      'grant execute on function public.add_recipe_to_active_shopping_list(uuid)',
    );
    expect(migration).toContain('public.ensure_active_shopping_list(target_household_id)');
    expect(migration).toContain('insert into public.shopping_items');
    expect(migration).not.toContain('service_role');
  });

  it('publishes recipe tables for realtime without changing shopping list publication', () => {
    expect(migration).toContain("array['recipes', 'recipe_items']");
    expect(migration).toContain('alter publication supabase_realtime add table public.%i');
  });

  it('takes the household advisory lock before locking a recipe during list insertion', () => {
    const addFunction = migration.indexOf(
      'create or replace function public.add_recipe_to_active_shopping_list',
    );
    const initialRecipeRead = migration.indexOf('select recipe.household_id', addFunction);
    const householdLock = migration.indexOf('pg_catalog.pg_advisory_xact_lock', initialRecipeRead);
    const lockedRecipeRead = migration.indexOf('into locked_household_id', householdLock);

    expect(initialRecipeRead).toBeGreaterThan(addFunction);
    expect(householdLock).toBeGreaterThan(initialRecipeRead);
    expect(lockedRecipeRead).toBeGreaterThan(householdLock);
  });

  it('stores ordered preparation steps with recipe cascade and household-scoped reads', () => {
    expect(stepsAndDeduplication).toContain('create table if not exists public.recipe_steps');
    expect(stepsSchema).toContain('recipe_iduuidnotnullreferencespublic.recipes(id)ondeletecascade');
    expect(stepsSchema).toContain('constraintrecipe_steps_recipe_sort_order_uniqueunique(recipe_id,sort_order)');
    expect(stepsAndDeduplication).toContain('alter table public.recipe_steps enable row level security');
    expect(stepsAndDeduplication).toContain('grant select on public.recipe_steps to authenticated');
    expect(stepsAndDeduplication).toContain('public.is_household_member(recipe.household_id)');
    expect(stepsAndDeduplication).toContain('public.save_recipe_with_steps');
    expect(stepsAndDeduplication).toContain('jsonb_array_elements(target_steps) with ordinality');
    expect(stepsAndDeduplication).toContain('alter publication supabase_realtime add table public.recipe_steps');
  });

  it('merges matching active-list products and avoids unsafe quantity or unit changes', () => {
    const addFunction = stepsAndDeduplication.slice(
      stepsAndDeduplication.indexOf(
        'create or replace function public.add_recipe_to_active_shopping_list',
      ),
      stepsAndDeduplication.indexOf(
        'revoke all on function public.add_recipe_to_active_shopping_list',
      ),
    );
    const compactFunction = addFunction.replace(/\s+/g, ' ');

    expect(compactFunction).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(compactFunction).toContain('public.ensure_active_shopping_list(target_household_id)');
    expect(compactFunction).toContain('shopping_item.list_id = target_list_id');
    expect(compactFunction).toContain('shopping_item.deleted_at is null');
    expect(compactFunction).toContain("'[[:space:]]+', ' ', 'g'");
    expect(compactFunction).toContain('existing_item.unit is not distinct from recipe_item.unit');
    expect(compactFunction).toContain('existing_item.quantity + recipe_item.quantity');
    expect(compactFunction).toContain('if not found then');
  });

  it('copies every recipe ingredient and preserves its fields on that household active list', () => {
    const addFunction = migration.slice(
      migration.indexOf(
        'create or replace function public.add_recipe_to_active_shopping_list',
      ),
      migration.indexOf('revoke all on function public.add_recipe_to_active_shopping_list'),
    );
    const compactFunction = addFunction.replace(/\s+/g, ' ').toLowerCase();

    expect(compactFunction).toContain(
      'from public.ensure_active_shopping_list(target_household_id) as active_list',
    );
    expect(compactFunction).toContain(
      'insert into public.shopping_items ( list_id, name, quantity, unit, category, created_by )',
    );
    expect(compactFunction).toContain(
      'select target_list_id, recipe_item.name, recipe_item.quantity, recipe_item.unit, recipe_item.category, current_user_id from public.recipe_items as recipe_item where recipe_item.recipe_id = target_recipe_id',
    );
    expect(compactFunction).toContain('get diagnostics inserted_item_count = row_count');
  });
});
