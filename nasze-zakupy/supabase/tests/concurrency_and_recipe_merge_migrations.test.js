const { readFileSync } = require('fs');
const { resolve } = require('path');

const concurrency = readFileSync(
  resolve(__dirname, '../migrations/202611050006_expected_updated_at_for_item_updates.sql'),
  'utf8',
).toLowerCase();
const recipeMerge = readFileSync(
  resolve(__dirname, '../migrations/202611050007_recipe_ingredients_merge_by_name_and_unit.sql'),
  'utf8',
).toLowerCase();

describe('expected updated_at for item updates', () => {
  test('drops old overloads before adding the version parameter', () => {
    expect(concurrency).toContain(
      'drop function if exists public.update_shopping_item(uuid, uuid, text, numeric, text, text);',
    );
    expect(concurrency).toContain(
      'drop function if exists public.update_todo_item(uuid, uuid, text, date, boolean, uuid[]);',
    );
  });

  test('rejects writes when the row changed since the client read it', () => {
    expect(concurrency).toContain('target_expected_updated_at timestamptz default null');
    expect(concurrency).toContain('current_item.updated_at is distinct from target_expected_updated_at');
    expect(concurrency).toContain('current_updated_at is distinct from target_expected_updated_at');
    expect(concurrency).toContain('changed by another user');
  });

  test('keeps the new signatures restricted to authenticated users', () => {
    expect(concurrency).toContain(
      'grant execute on function public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz)',
    );
    expect(concurrency).toContain(
      'grant execute on function public.update_todo_item(uuid, uuid, text, date, boolean, uuid[], timestamptz)',
    );
    expect(concurrency).toContain('to authenticated;');
  });
});

describe('recipe ingredients merge by name and unit', () => {
  test('merges only unpurchased rows with the same unit and a present quantity', () => {
    expect(recipeMerge).toContain('shopping_item.is_purchased = false');
    expect(recipeMerge).toContain('shopping_item.unit is not distinct from recipe_item.unit');
    expect(recipeMerge).toContain('shopping_item.quantity is not null');
    expect(recipeMerge).toContain('recipe_item.quantity is not null');
    expect(recipeMerge).toContain('<= 999999999.999');
  });

  test('never skips an ingredient: every other case inserts a row', () => {
    expect(recipeMerge).toContain('insert into public.shopping_items');
    expect(recipeMerge).not.toContain('elsif');
    expect(recipeMerge).toContain('items_merged integer');
  });
});
