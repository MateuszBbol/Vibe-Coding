begin;

create unique index if not exists todo_items_household_id_id_idx
  on public.todo_items (household_id, id);

create table if not exists public.todo_item_assignees (
  household_id uuid not null,
  todo_item_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  primary key (todo_item_id, user_id),
  constraint todo_item_assignees_item_household_fkey
    foreign key (household_id, todo_item_id)
    references public.todo_items (household_id, id)
    on delete cascade,
  constraint todo_item_assignees_member_fkey
    foreign key (household_id, user_id)
    references public.household_members (household_id, user_id)
    on delete cascade
);

create index if not exists todo_item_assignees_household_user_idx
  on public.todo_item_assignees (household_id, user_id);

alter table public.todo_item_assignees replica identity full;
alter table public.todo_item_assignees enable row level security;
revoke all on public.todo_item_assignees from anon, authenticated;
grant select on public.todo_item_assignees to authenticated;

drop policy if exists "Members can read todo item assignees"
  on public.todo_item_assignees;
create policy "Members can read todo item assignees"
  on public.todo_item_assignees for select to authenticated
  using (public.is_household_member(household_id));

create or replace function public.fetch_todo_household_members(target_household_id uuid)
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select member.user_id, nullif(pg_catalog.btrim(profile.display_name), '')
  from public.household_members as member
  left join public.profiles as profile on profile.id = member.user_id
  where member.household_id = target_household_id
    and public.is_household_member(target_household_id)
  order by pg_catalog.lower(coalesce(profile.display_name, '')), member.joined_at;
$$;

create or replace function public.create_todo_item(
  target_household_id uuid,
  target_title text,
  target_due_date date,
  target_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_item_id uuid;
begin
  if auth.uid() is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Household unavailable.';
  end if;

  if target_title is null
    or pg_catalog.char_length(pg_catalog.btrim(target_title)) not between 1 and 200
  then
    raise exception 'Task title must contain between 1 and 200 characters.';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(coalesce(target_user_ids, '{}'::uuid[])) as requested(user_id)
    where not exists (
      select 1
      from public.household_members as member
      where member.household_id = target_household_id
        and member.user_id = requested.user_id
    )
  ) then
    raise exception 'An assigned user is not a member of this household.';
  end if;

  insert into public.todo_items (household_id, title, due_date, created_by)
  values (
    target_household_id,
    pg_catalog.btrim(target_title),
    target_due_date,
    auth.uid()
  )
  returning id into new_item_id;

  insert into public.todo_item_assignees (household_id, todo_item_id, user_id)
  select target_household_id, new_item_id, requested.user_id
  from (
    select distinct pg_catalog.unnest(coalesce(target_user_ids, '{}'::uuid[])) as user_id
  ) as requested
  on conflict (todo_item_id, user_id) do nothing;

  return new_item_id;
end;
$$;

create or replace function public.update_todo_item(
  target_household_id uuid,
  target_item_id uuid,
  target_title text,
  target_due_date date,
  target_completed boolean,
  target_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actual_household_id uuid;
begin
  if auth.uid() is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Household unavailable.';
  end if;

  if target_title is null
    or pg_catalog.char_length(pg_catalog.btrim(target_title)) not between 1 and 200
  then
    raise exception 'Task title must contain between 1 and 200 characters.';
  end if;

  select item.household_id
  into actual_household_id
  from public.todo_items as item
  where item.id = target_item_id
  for update;

  if actual_household_id is distinct from target_household_id then
    raise exception 'Task unavailable.';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(coalesce(target_user_ids, '{}'::uuid[])) as requested(user_id)
    where not exists (
      select 1
      from public.household_members as member
      where member.household_id = target_household_id
        and member.user_id = requested.user_id
    )
  ) then
    raise exception 'An assigned user is not a member of this household.';
  end if;

  update public.todo_items
  set title = pg_catalog.btrim(target_title),
      due_date = target_due_date,
      completed = target_completed
  where id = target_item_id
    and household_id = target_household_id;

  delete from public.todo_item_assignees
  where household_id = target_household_id
    and todo_item_id = target_item_id;

  insert into public.todo_item_assignees (household_id, todo_item_id, user_id)
  select target_household_id, target_item_id, requested.user_id
  from (
    select distinct pg_catalog.unnest(coalesce(target_user_ids, '{}'::uuid[])) as user_id
  ) as requested
  on conflict (todo_item_id, user_id) do nothing;
end;
$$;

revoke all on function public.fetch_todo_household_members(uuid) from public, anon;
revoke all on function public.create_todo_item(uuid, text, date, uuid[]) from public, anon;
revoke all on function public.update_todo_item(uuid, uuid, text, date, boolean, uuid[])
  from public, anon;
grant execute on function public.fetch_todo_household_members(uuid) to authenticated;
grant execute on function public.create_todo_item(uuid, text, date, uuid[]) to authenticated;
grant execute on function public.update_todo_item(uuid, uuid, text, date, boolean, uuid[])
  to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'todo_item_assignees'
  ) then
    alter publication supabase_realtime add table public.todo_item_assignees;
  end if;
end;
$$;

commit;
