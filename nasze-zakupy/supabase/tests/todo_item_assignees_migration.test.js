const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202611050004_todo_item_assignees.sql'),
  'utf8',
).toLowerCase();
const compact = migration.replace(/\s+/g, '');

describe('To Do assignment migration contract', () => {
  it('cascades assignment rows with tasks and household membership without deleting tasks', () => {
    expect(compact).toContain(
      'foreignkey(household_id,todo_item_id)referencespublic.todo_items(household_id,id)ondeletecascade',
    );
    expect(compact).toContain(
      'foreignkey(household_id,user_id)referencespublic.household_members(household_id,user_id)ondeletecascade',
    );
    expect(compact).toContain('primarykey(todo_item_id,user_id)');
    expect(migration).toContain('create unique index if not exists todo_items_household_id_id_idx');
    expect(migration).not.toContain('delete from public.todo_items');
  });

  it('keeps assignment reads household-scoped and writes behind membership-validating RPCs', () => {
    expect(migration).toContain('alter table public.todo_item_assignees enable row level security');
    expect(migration).toContain(
      'revoke all on public.todo_item_assignees from anon, authenticated',
    );
    expect(migration).toContain('grant select on public.todo_item_assignees to authenticated');
    expect(migration).toContain('public.is_household_member(household_id)');
    expect(migration).toContain('create or replace function public.create_todo_item(');
    expect(migration).toContain('create or replace function public.update_todo_item(');
    expect(migration).toContain('an assigned user is not a member of this household');
    expect(migration).toContain('create or replace function public.fetch_todo_household_members');
    expect(migration).toContain('public.is_household_member(target_household_id)');
    expect(migration).toContain('grant execute on function public.create_todo_item');
    expect(migration).toContain('grant execute on function public.update_todo_item');
  });

  it('publishes household-filterable assignments to Realtime once', () => {
    expect(compact).toContain('createindexifnotexiststodo_item_assignees_household_user_idx');
    expect(migration).toContain('alter table public.todo_item_assignees replica identity full');
    expect(migration).toContain("tablename = 'todo_item_assignees'");
    expect(migration).toContain(
      'alter publication supabase_realtime add table public.todo_item_assignees',
    );
  });
});
