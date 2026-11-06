const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202611090001_recipe_step_ingredients.sql'),
  'utf8',
).toLowerCase();

describe('recipe step ingredients migration', () => {
  test('adds an optional list of ingredient positions to every step', () => {
    expect(migration.trim().startsWith('begin;')).toBe(true);
    expect(migration.trim().endsWith('commit;')).toBe(true);
    expect(migration).toContain(
      "add column if not exists ingredient_sort_orders integer[] not null default '{}'",
    );
    expect(migration).toContain('pg_catalog.cardinality(ingredient_sort_orders) <= 100');
  });

  test('keeps the save function signature and validates step ingredients', () => {
    expect(migration).toContain('create or replace function public.save_recipe_with_steps(');
    expect(migration).toContain("step.value ? 'ingredient_indexes'");
    expect(migration).toContain('>= item_count');
    expect(migration).toContain("raise exception 'recipe preparation steps are invalid.'");
  });

  test('stores unique, ordered positions and an empty list when none are chosen', () => {
    expect(migration).toContain("pg_catalog.array_agg(distinct (idx.value #>> '{}')::integer");
    expect(migration).toContain("'{}'::integer[]");
  });

  test('keeps the RPC restricted to authenticated users', () => {
    expect(migration).toContain(
      'grant execute on function public.save_recipe_with_steps(uuid, uuid, text, text, jsonb, jsonb)\n  to authenticated;',
    );
  });
});
