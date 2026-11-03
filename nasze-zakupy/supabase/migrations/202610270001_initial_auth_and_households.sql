create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text not null,
  avatar_url text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 80
  )
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint households_name_length check (char_length(btrim(name)) between 1 and 80)
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default pg_catalog.now(),
  primary key (household_id, user_id),
  constraint household_members_role check (role in ('owner', 'member'))
);

create table public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null default (pg_catalog.now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  constraint household_invitations_status check (
    status in ('pending', 'accepted', 'expired', 'cancelled')
  ),
  constraint household_invitations_email_lowercase check (invited_email = lower(invited_email))
);

create unique index household_invitations_pending_email_idx
  on public.household_invitations (household_id, invited_email)
  where status = 'pending';

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  icon_name text not null default 'basket',
  color_key text not null default 'green',
  currency_code text not null default 'PLN',
  purchased_items_behavior text not null default 'move_to_bottom',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  archived_at timestamptz,
  constraint shopping_lists_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint shopping_lists_currency_code check (currency_code ~ '^[A-Z]{3}$'),
  constraint shopping_lists_purchased_behavior check (
    purchased_items_behavior in ('move_to_bottom', 'hide', 'ask')
  )
);

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  name text not null,
  quantity numeric(12, 3) not null default 1,
  unit text not null,
  category text,
  note text,
  unit_price numeric(12, 2),
  is_purchased boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  purchased_by uuid references auth.users (id) on delete set null,
  purchased_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  sort_order integer not null default 0,
  deleted_at timestamptz,
  constraint shopping_items_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint shopping_items_quantity_positive check (quantity > 0),
  constraint shopping_items_unit_length check (char_length(btrim(unit)) between 1 and 32),
  constraint shopping_items_unit_price_nonnegative check (unit_price is null or unit_price >= 0)
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notify_new_items boolean not null default true,
  notify_purchased_items boolean not null default true,
  notify_deleted_items boolean not null default true,
  notify_list_changes boolean not null default true,
  default_currency text not null default 'PLN',
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint user_settings_currency_code check (default_currency ~ '^[A-Z]{3}$')
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expo_push_token text not null unique,
  device_id text not null,
  platform text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  last_used_at timestamptz not null default pg_catalog.now(),
  constraint push_tokens_platform check (platform in ('ios', 'android'))
);

create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_household_owner(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.households h
    where h.id = target_household_id
      and h.owner_id = (select auth.uid())
  );
$$;

create or replace function public.can_access_shopping_list(target_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shopping_lists sl
    join public.household_members hm on hm.household_id = sl.household_id
    where sl.id = target_list_id
      and hm.user_id = (select auth.uid())
  );
$$;

create index household_members_user_id_idx on public.household_members (user_id);
create index household_members_household_id_idx on public.household_members (household_id);
create index shopping_lists_household_id_idx on public.shopping_lists (household_id);
create index shopping_items_list_id_idx on public.shopping_items (list_id);
create index shopping_items_updated_at_idx on public.shopping_items (updated_at);
create index household_invitations_invited_email_idx on public.household_invitations (invited_email);
create index push_tokens_user_id_idx on public.push_tokens (user_id);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  insert into public.user_settings (user_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.add_household_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.household_members (household_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_household_created_add_owner
  after insert on public.households
  for each row execute function public.add_household_owner_as_member();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger households_updated_at before update on public.households
  for each row execute function public.set_updated_at();
create trigger shopping_lists_updated_at before update on public.shopping_lists
  for each row execute function public.set_updated_at();
create trigger shopping_items_updated_at before update on public.shopping_items
  for each row execute function public.set_updated_at();
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger push_tokens_updated_at before update on public.push_tokens
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_items enable row level security;
alter table public.user_settings enable row level security;
alter table public.push_tokens enable row level security;

revoke all on public.profiles, public.households, public.household_members,
  public.household_invitations, public.shopping_lists, public.shopping_items,
  public.user_settings, public.push_tokens from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, delete on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select, delete on public.household_members to authenticated;
grant select (id, household_id, invited_email, invited_by, status, expires_at, accepted_at, created_at)
  on public.household_invitations to authenticated;
grant insert on public.household_invitations to authenticated;
grant update (status) on public.household_invitations to authenticated;
grant select, insert, delete on public.shopping_lists to authenticated;
grant update (name, icon_name, color_key, currency_code, purchased_items_behavior, archived_at)
  on public.shopping_lists to authenticated;
grant select, insert, delete on public.shopping_items to authenticated;
grant update (
  name, quantity, unit, category, note, unit_price, is_purchased,
  purchased_by, purchased_at, sort_order, deleted_at
) on public.shopping_items to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;

create policy "Profiles are readable by their owner"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "Profiles can be updated by their owner"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Households are readable by their members"
  on public.households for select to authenticated
  using (public.is_household_member(id) or owner_id = (select auth.uid()));
create policy "Authenticated users can create their own household"
  on public.households for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners can update their household"
  on public.households for update to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));
create policy "Owners can delete their household"
  on public.households for delete to authenticated
  using (public.is_household_owner(id));

create policy "Members can view household membership"
  on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
create policy "Owners can remove other members and members can leave"
  on public.household_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role = 'member')
    or (user_id <> (select auth.uid()) and public.is_household_owner(household_id))
  );

create policy "Owners can read household invitations"
  on public.household_invitations for select to authenticated
  using (public.is_household_owner(household_id));
create policy "Owners can create household invitations"
  on public.household_invitations for insert to authenticated
  with check (
    public.is_household_owner(household_id)
    and invited_by = (select auth.uid())
    and status = 'pending'
  );
create policy "Owners can cancel pending household invitations"
  on public.household_invitations for update to authenticated
  using (public.is_household_owner(household_id) and status = 'pending')
  with check (public.is_household_owner(household_id) and status = 'cancelled');

create policy "Members can read household lists"
  on public.shopping_lists for select to authenticated
  using (public.is_household_member(household_id));
create policy "Members can create household lists"
  on public.shopping_lists for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = (select auth.uid())
  );
create policy "Members can update household lists"
  on public.shopping_lists for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "Members can delete household lists"
  on public.shopping_lists for delete to authenticated
  using (public.is_household_member(household_id));

create policy "Members can read items on household lists"
  on public.shopping_items for select to authenticated
  using (public.can_access_shopping_list(list_id));
create policy "Members can add items to household lists"
  on public.shopping_items for insert to authenticated
  with check (
    public.can_access_shopping_list(list_id)
    and created_by = (select auth.uid())
  );
create policy "Members can update items on household lists"
  on public.shopping_items for update to authenticated
  using (public.can_access_shopping_list(list_id))
  with check (public.can_access_shopping_list(list_id));
create policy "Members can delete items on household lists"
  on public.shopping_items for delete to authenticated
  using (public.can_access_shopping_list(list_id));

create policy "Users can read their settings"
  on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can create their settings"
  on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can update their settings"
  on public.user_settings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can manage their push tokens"
  on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on function public.is_household_member(uuid) from public, anon;
revoke all on function public.is_household_owner(uuid) from public, anon;
revoke all on function public.can_access_shopping_list(uuid) from public, anon;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.can_access_shopping_list(uuid) to authenticated;
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;
revoke all on function public.add_household_owner_as_member() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['shopping_lists', 'shopping_items'] loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target_table
    ) then
      execute pg_catalog.format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end;
$$;
