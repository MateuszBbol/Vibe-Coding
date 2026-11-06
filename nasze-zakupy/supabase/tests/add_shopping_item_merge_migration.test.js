const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202611060001_add_shopping_item_merge.sql'),
  'utf8',
).toLowerCase();

describe('add_shopping_item merge migration', () => {
  test('runs as a definer function with an empty search path inside a transaction', () => {
    expect(migration.trim().startsWith('begin;')).toBe(true);
    expect(migration.trim().endsWith('commit;')).toBe(true);
    expect(migration).toContain('create or replace function public.add_shopping_item(');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
  });

  test('requires a signed-in household member and serialises adds per household', () => {
    expect(migration).toContain("raise exception 'authentication required.'");
    expect(migration).toContain('not public.is_household_member(target_household_id)');
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock(');
  });

  test('merges only into an unpurchased row with the same name and unit', () => {
    expect(migration).toContain('shopping_item.is_purchased = false');
    expect(migration).toContain('shopping_item.deleted_at is null');
    expect(migration).toContain('shopping_item.unit is not distinct from normalized_unit');
    expect(migration).toContain('shopping_item.quantity is not null');
    expect(migration).toContain('target_quantity is not null');
    expect(migration).toContain('shopping_item.quantity + target_quantity <= 999999999.999');
    expect(migration).toContain('pg_catalog.lower(');
    expect(migration).toContain('set quantity = existing_item.quantity + target_quantity');
  });

  test('otherwise inserts a new row owned by the caller', () => {
    expect(migration).toContain('insert into public.shopping_items (list_id, name, quantity, unit, category, created_by)');
    expect(migration).toContain('current_user_id');
  });

  test('is executable only by authenticated users', () => {
    expect(migration).toContain(
      'revoke all on function public.add_shopping_item(uuid, text, numeric, text, text)\n  from public, anon, authenticated;',
    );
    expect(migration).toContain(
      'grant execute on function public.add_shopping_item(uuid, text, numeric, text, text)\n  to authenticated;',
    );
  });
});
