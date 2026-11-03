const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202610280005_delete_household_rpc.sql'),
  'utf8',
).toLowerCase();
const schema = readFileSync(
  resolve(__dirname, '../migrations/202610270001_initial_auth_and_households.sql'),
  'utf8',
).toLowerCase();
const householdRpcs = readFileSync(
  resolve(__dirname, '../migrations/202610280001_household_invitation_and_active_list_rpcs.sql'),
  'utf8',
).toLowerCase();
const normalizedMigration = migration.replace(/\s+/g, '');
const normalizedSchema = schema.replace(/\s+/g, '');
const normalizedHouseholdRpcs = householdRpcs.replace(/\s+/g, '');

describe('household deletion migration contract', () => {
  it('uses a security-definer RPC with a locked household and database-side owner verification', () => {
    expect(migration).toContain('create or replace function public.delete_household(');
    expect(migration).toContain('security definer');
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain('for update of household');
    expect(migration).toContain('current_household_owner_id <> current_user_id');
    expect(migration).toContain("current_membership_role is distinct from 'owner'");
  });

  it('checks the current household name and deletes exactly the requested owner household', () => {
    expect(normalizedMigration).toContain(
      'pg_catalog.btrim(confirmation_name)<>pg_catalog.btrim(current_household_name)',
    );
    expect(migration).toContain('delete from public.households as household');
    expect(migration).toContain('where household.id = target_household_id');
    expect(migration).toContain('and household.owner_id = current_user_id');
    expect(migration).toContain('deleted_household_count <> 1');
    expect(migration).not.toContain('delete from auth.users');
    expect(migration).not.toContain('delete from public.profiles');
  });

  it('revokes direct deletes and grants the RPC only to authenticated users', () => {
    expect(migration).toContain('revoke delete on public.households from authenticated');
    expect(migration).toContain(
      'revoke all on function public.delete_household(uuid, text) from public, anon, authenticated',
    );
    expect(migration).toContain(
      'grant execute on function public.delete_household(uuid, text) to authenticated',
    );
  });

  it('serializes household deletion and invitation acceptance with the active-list lock', () => {
    const activeListLock = normalizedHouseholdRpcs.indexOf(
      'pg_catalog.hashtextextended(target_household_id::text,0)',
    );
    const deleteFunctionStart = normalizedMigration.indexOf(
      'createorreplacefunctionpublic.delete_household(',
    );
    const deleteLock = normalizedMigration.indexOf(
      'pg_catalog.hashtextextended(target_household_id::text,0)',
      deleteFunctionStart,
    );
    const acceptHouseholdLock = normalizedMigration.indexOf(
      'pg_catalog.hashtextextended(target_household_id::text,0)',
    );
    const invitationRowLock = normalizedMigration.indexOf('forupdateofinvitation');

    expect(activeListLock).toBeGreaterThanOrEqual(0);
    expect(deleteLock).toBeGreaterThanOrEqual(0);
    expect(acceptHouseholdLock).toBeGreaterThanOrEqual(0);
    expect(invitationRowLock).toBeGreaterThan(acceptHouseholdLock);
  });

  it('relies on the actual household-to-list-to-product cascade tree', () => {
    expect(normalizedSchema).toContain(
      'household_iduuidnotnullreferencespublic.households(id)ondeletecascade',
    );
    expect(normalizedSchema).toContain(
      'list_iduuidnotnullreferencespublic.shopping_lists(id)ondeletecascade',
    );
  });
});
