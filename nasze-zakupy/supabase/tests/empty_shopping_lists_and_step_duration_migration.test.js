const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(
    __dirname,
    '../migrations/202611050002_optional_recipe_step_duration_and_empty_shopping_lists.sql',
  ),
  'utf8',
).toLowerCase();
const compact = migration.replace(/\s+/g, '');

describe('optional recipe step duration and empty shopping list migration', () => {
  it('adds an optional, non-negative integer duration to recipe steps', () => {
    expect(compact).toContain(
      'addcolumnifnotexistsduration_minutesintegercheck(duration_minutesisnullorduration_minutes>=0)',
    );
    expect(migration).toContain('insert into public.recipe_steps (recipe_id, text, sort_order, duration_minutes)');
    expect(migration).toContain("step.value ->> 'duration_minutes'");
  });

  it('does not silently recreate lists when ensuring the active list', () => {
    const ensureFunction = migration.slice(
      migration.indexOf('create or replace function public.ensure_active_shopping_list'),
      migration.indexOf('create or replace function public.create_household'),
    );
    expect(ensureFunction).toContain('return query');
    expect(ensureFunction).not.toContain('insert into public.shopping_lists');
  });

  it('creates lists explicitly and serializes create/delete for household members', () => {
    expect(migration).toContain('create or replace function public.create_shopping_list');
    expect(migration).toContain('create or replace function public.delete_shopping_list');
    expect(migration).toContain('public.household_members as membership');
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migration).toContain('grant execute on function public.create_shopping_list(uuid) to authenticated');
    expect(migration).toContain('grant execute on function public.delete_shopping_list(uuid) to authenticated');
  });

  it('keeps new household creation provisioned with its initial shopping list', () => {
    const createHousehold = migration.slice(
      migration.indexOf('create or replace function public.create_household'),
      migration.indexOf('create or replace function public.create_shopping_list'),
    );
    expect(createHousehold).toContain('insert into public.shopping_lists');
    expect(createHousehold).toContain('created_household_id');
  });
});
