const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202611070001_update_shopping_item_merge_like_add.sql'),
  'utf8',
).toLowerCase();

describe('update_shopping_item merge rule migration', () => {
  test('replaces the function in one transaction with a fixed search path', () => {
    expect(migration.trim().startsWith('begin;')).toBe(true);
    expect(migration.trim().endsWith('commit;')).toBe(true);
    expect(migration).toContain(
      'drop function if exists public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz);',
    );
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
  });

  test('keeps membership, locking and the concurrent-edit check', () => {
    expect(migration).toContain('not public.is_household_member(target_household_id)');
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock(');
    expect(migration).toContain('current_item.updated_at is distinct from target_expected_updated_at');
    expect(migration).toContain('changed by another user');
  });

  test('never merges into purchased rows and only merges safe twins', () => {
    expect(migration).toContain('shopping_item.is_purchased = false');
    expect(migration).toContain('shopping_item.unit is not distinct from normalized_unit');
    expect(migration).toContain('shopping_item.quantity is not null');
    expect(migration).toContain('target_quantity is not null');
    expect(migration).toContain('shopping_item.quantity + target_quantity <= 999999999.999');
  });

  test('saves the edited row instead of failing when a merge is not safe', () => {
    expect(migration).not.toContain("raise exception 'a product with this name already exists");
    expect(migration).toContain('set name = pg_catalog.btrim(target_name)');
  });

  test('is executable only by authenticated users', () => {
    expect(migration).toContain(
      'revoke all on function public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz)\n  from public, anon, authenticated;',
    );
    expect(migration).toContain(
      'grant execute on function public.update_shopping_item(uuid, uuid, text, numeric, text, text, timestamptz)\n  to authenticated;',
    );
  });
});
