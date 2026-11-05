const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202611050005_update_shopping_item.sql'),
  'utf8',
).toLowerCase();
const compact = migration.replace(/\s+/g, '');

describe('shopping item edit migration contract', () => {
  it('updates only items on an accessible list and validates inputs', () => {
    expect(migration).toContain('create or replace function public.update_shopping_item(');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('public.is_household_member(target_household_id)');
    expect(migration).toContain('shopping_item.id = target_item_id');
    expect(migration).toContain('product quantity is invalid');
  });

  it('serializes edits and merges normalized duplicate names only when quantities and units are safe', () => {
    expect(migration).toContain('pg_catalog.pg_advisory_xact_lock');
    expect(migration).toContain('regexp_replace(');
    expect(migration).toContain('matching_item.unit is distinct from target_unit');
    expect(migration).toContain('matching_item.quantity + target_quantity');
    expect(migration).toContain('cannot be safely merged');
    expect(migration).toContain('delete from public.shopping_items as shopping_item');
  });

  it('grants only authenticated callers access to the RPC', () => {
    expect(compact).toContain(
      'revokeallonfunctionpublic.update_shopping_item(uuid,uuid,text,numeric,text,text)frompublic,anon',
    );
    expect(compact).toContain(
      'grantexecuteonfunctionpublic.update_shopping_item(uuid,uuid,text,numeric,text,text)toauthenticated',
    );
  });
});
