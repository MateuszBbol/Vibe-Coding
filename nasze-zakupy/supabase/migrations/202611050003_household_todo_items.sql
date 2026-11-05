begin;

create table if not exists public.todo_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  due_date date,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  created_by uuid not null references auth.users (id) on delete cascade,
  constraint todo_items_title_length check (
    char_length(btrim(title)) between 1 and 200
  )
);

create index if not exists todo_items_household_status_due_idx
  on public.todo_items (household_id, completed, due_date, created_at);

alter table public.todo_items replica identity full;

drop trigger if exists todo_items_updated_at on public.todo_items;
create trigger todo_items_updated_at before update on public.todo_items
  for each row execute function public.set_updated_at();

alter table public.todo_items enable row level security;
revoke all on public.todo_items from anon, authenticated;
grant select, insert, delete on public.todo_items to authenticated;
grant update (title, completed, due_date) on public.todo_items to authenticated;

drop policy if exists "Members can read household todo items" on public.todo_items;
create policy "Members can read household todo items"
  on public.todo_items for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "Members can add household todo items" on public.todo_items;
create policy "Members can add household todo items"
  on public.todo_items for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = (select auth.uid())
  );

drop policy if exists "Members can update household todo items" on public.todo_items;
create policy "Members can update household todo items"
  on public.todo_items for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists "Members can delete household todo items" on public.todo_items;
create policy "Members can delete household todo items"
  on public.todo_items for delete to authenticated
  using (public.is_household_member(household_id));

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'todo_items'
  ) then
    alter publication supabase_realtime add table public.todo_items;
  end if;
end;
$$;

commit;
