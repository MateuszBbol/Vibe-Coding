const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202611050003_household_todo_items.sql'),
  'utf8',
).toLowerCase();
const compact = migration.replace(/\s+/g, '');

describe('household To Do migration contract', () => {
  it('creates household-scoped tasks with optional deadlines and safe defaults', () => {
    expect(compact).toContain(
      'household_iduuidnotnullreferencespublic.households(id)ondeletecascade',
    );
    expect(compact).toContain('titletextnotnull');
    expect(compact).toContain('completedbooleannotnulldefaultfalse');
    expect(compact).toContain('due_datedate');
    expect(compact).toContain('created_attimestamptznotnulldefaultpg_catalog.now()');
    expect(compact).toContain('created_byuuidnotnullreferencesauth.users(id)ondeletecascade');
    expect(migration).toContain('char_length(btrim(title)) between 1 and 200');
  });

  it('limits reads and writes to authenticated household members', () => {
    expect(migration).toContain('alter table public.todo_items enable row level security');
    expect(migration).toContain('revoke all on public.todo_items from anon, authenticated');
    expect(migration).toContain(
      'grant select, insert, delete on public.todo_items to authenticated',
    );
    expect(migration).toContain(
      'grant update (title, completed, due_date) on public.todo_items to authenticated',
    );
    expect(migration).toContain('public.is_household_member(household_id)');
    expect(migration).toContain('created_by = (select auth.uid())');
    expect(migration).toContain('for select to authenticated');
    expect(migration).toContain('for insert to authenticated');
    expect(migration).toContain('for update to authenticated');
    expect(migration).toContain('for delete to authenticated');
  });

  it('indexes task ordering, updates timestamps, and enables realtime idempotently', () => {
    expect(migration).toContain(
      'on public.todo_items (household_id, completed, due_date, created_at)',
    );
    expect(migration).toContain('execute function public.set_updated_at()');
    expect(migration).toContain('alter table public.todo_items replica identity full');
    expect(migration).toContain("tablename = 'todo_items'");
    expect(migration).toContain('alter publication supabase_realtime add table public.todo_items');
    expect(migration).toContain('create table if not exists public.todo_items');
    expect(migration).toContain('create index if not exists todo_items_household_status_due_idx');
  });
});
