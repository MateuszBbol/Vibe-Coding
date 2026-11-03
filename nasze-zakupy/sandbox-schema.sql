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
create or replace function public.ensure_active_shopping_list(target_household_id uuid)
returns table (list_id uuid, list_name text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
    or not exists (
      select 1
      from public.household_members hm
      where hm.household_id = target_household_id
        and hm.user_id = (select auth.uid())
    )
  then
    raise exception 'Household unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  return query
    select sl.id, sl.name
    from public.shopping_lists sl
    where sl.household_id = target_household_id
      and sl.archived_at is null
    order by sl.created_at, sl.id
    limit 1;

  if found then
    return;
  end if;

  insert into public.shopping_lists (household_id, name, created_by)
  values (target_household_id, 'Zakupy', (select auth.uid()))
  returning id, name into list_id, list_name;

  return next;
end;
$$;

create or replace function public.create_household_invitation(
  target_household_id uuid,
  target_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(target_email));
  invite_token text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if normalized_email is null
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or pg_catalog.char_length(normalized_email) > 254
  then
    raise exception 'Enter a valid email address.';
  end if;

  if not exists (
    select 1
    from public.households h
    where h.id = target_household_id
      and h.owner_id = current_user_id
  ) then
    raise exception 'Household unavailable.';
  end if;

  select pg_catalog.lower(u.email)
    into current_user_email
    from auth.users u
    where u.id = current_user_id;

  if normalized_email = current_user_email then
    raise exception 'You cannot invite your own account.';
  end if;

  if not exists (
    select 1
    from auth.users u
    where pg_catalog.lower(u.email) = normalized_email
  ) then
    raise exception 'No account exists for this email address.';
  end if;

  if exists (
    select 1
    from public.household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = target_household_id
      and pg_catalog.lower(u.email) = normalized_email
  ) then
    raise exception 'This account is already a household member.';
  end if;

  update public.household_invitations hi
    set status = 'cancelled'
    where hi.household_id = target_household_id
      and hi.invited_email = normalized_email
      and hi.status = 'pending';

  invite_token :=
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '')
    || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');

  insert into public.household_invitations (
    household_id,
    invited_email,
    invited_by,
    token_hash
  )
  values (
    target_household_id,
    normalized_email,
    current_user_id,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(invite_token, 'UTF8')),
      'hex'
    )
  );

  return invite_token;
end;
$$;

create or replace function public.accept_household_invitation(invitation_token text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  target_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if invitation_token is null or invitation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  select pg_catalog.lower(u.email)
    into current_user_email
    from auth.users u
    where u.id = current_user_id;

  select hi.household_id
    into target_household_id
    from public.household_invitations hi
    where hi.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and hi.invited_email = current_user_email
      and hi.status = 'pending'
      and hi.expires_at > pg_catalog.now()
    for update;

  if target_household_id is null then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  if exists (
    select 1
    from public.household_members hm
    where hm.user_id = current_user_id
      and hm.household_id <> target_household_id
  ) then
    raise exception 'This account already belongs to another household.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_household_id, current_user_id, 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invitations hi
    set status = 'accepted',
        accepted_at = pg_catalog.now()
    where hi.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      );

  return query
    select h.id, h.name
    from public.households h
    where h.id = target_household_id;
end;
$$;

revoke all on function public.ensure_active_shopping_list(uuid) from public, anon, authenticated;
revoke all on function public.create_household_invitation(uuid, text) from public, anon, authenticated;
revoke all on function public.accept_household_invitation(text) from public, anon, authenticated;

grant execute on function public.ensure_active_shopping_list(uuid) to authenticated;
grant execute on function public.create_household_invitation(uuid, text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
create or replace function public.accept_household_invitation(invitation_token text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  target_household_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if invitation_token is null or invitation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  select pg_catalog.lower(u.email)
    into current_user_email
    from auth.users u
    where u.id = current_user_id;

  select invitation.household_id
    into target_household_id
    from public.household_invitations as invitation
    where invitation.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and invitation.invited_email = current_user_email
      and invitation.status = 'pending'
      and invitation.expires_at > pg_catalog.now()
    for update of invitation;

  if target_household_id is null then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  if exists (
    select 1
    from public.household_members as existing_member
    where existing_member.user_id = current_user_id
      and existing_member.household_id <> target_household_id
  ) then
    raise exception 'This account already belongs to another household.';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (target_household_id, current_user_id, 'member')
  on conflict on constraint household_members_pkey do nothing;

  update public.household_invitations as invitation
    set status = 'accepted',
        accepted_at = pg_catalog.now()
    where invitation.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and invitation.household_id = target_household_id
      and invitation.invited_email = current_user_email
      and invitation.status = 'pending'
      and invitation.expires_at > pg_catalog.now();

  return query
    select household.id, household.name
    from public.households as household
    where household.id = target_household_id;
end;
$$;

revoke all on function public.accept_household_invitation(text)
  from public, anon, authenticated;
grant execute on function public.accept_household_invitation(text)
  to authenticated;
begin;

alter table public.shopping_items
  alter column quantity drop not null,
  alter column unit drop not null;

commit;
begin;

revoke insert on public.households from authenticated;

create or replace function public.create_household(target_name text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_membership_count bigint;
  created_household_id uuid;
  created_household_name text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 847201)
  );

  select pg_catalog.count(*)
    into current_membership_count
    from public.household_members as membership
    where membership.user_id = current_user_id;

  if current_membership_count >= 3 then
    raise exception 'Household limit reached.';
  end if;

  insert into public.households (name, owner_id)
    values (target_name, current_user_id)
    returning id, name
    into created_household_id, created_household_name;

  return query
    select created_household_id, created_household_name;
end;
$$;

create or replace function public.accept_household_invitation(invitation_token text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  target_household_id uuid;
  target_household_name text;
  current_membership_count bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 847201)
  );

  if invitation_token is null or invitation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  select pg_catalog.lower(auth_user.email)
    into current_user_email
    from auth.users as auth_user
    where auth_user.id = current_user_id;

  select invitation.household_id
    into target_household_id
    from public.household_invitations as invitation
    where invitation.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and invitation.invited_email = current_user_email
      and invitation.status = 'pending'
      and invitation.expires_at > pg_catalog.now()
    for update of invitation;

  if target_household_id is null then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  if not exists (
    select 1
      from public.household_members as existing_membership
      where existing_membership.household_id = target_household_id
        and existing_membership.user_id = current_user_id
  ) then
    select pg_catalog.count(*)
      into current_membership_count
      from public.household_members as membership
      where membership.user_id = current_user_id;

    if current_membership_count >= 3 then
      raise exception 'Household limit reached.';
    end if;

    insert into public.household_members (household_id, user_id, role)
      values (target_household_id, current_user_id, 'member')
      on conflict on constraint household_members_pkey do nothing;
  end if;

  update public.household_invitations as invitation
    set status = 'accepted',
        accepted_at = pg_catalog.now()
    where invitation.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and invitation.household_id = target_household_id
      and invitation.invited_email = current_user_email
      and invitation.status = 'pending'
      and invitation.expires_at > pg_catalog.now();

  select household.name
    into target_household_name
    from public.households as household
    where household.id = target_household_id;

  return query
    select target_household_id, target_household_name;
end;
$$;

create or replace function public.leave_household(target_household_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  membership_role text;
  household_member_count bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 847201)
  );

  select membership.role
    into membership_role
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = current_user_id
    for update of membership;

  if membership_role is null then
    raise exception 'Household membership not found.';
  end if;

  if membership_role = 'owner' then
    raise exception 'Household owner cannot leave.';
  end if;

  select pg_catalog.count(*)
    into household_member_count
    from public.household_members as membership
    where membership.household_id = target_household_id;

  if household_member_count <= 1 then
    raise exception 'The last household member cannot leave.';
  end if;

  delete from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = current_user_id
      and membership.role = 'member';
end;
$$;

revoke all on function public.create_household(text) from public, anon, authenticated;
revoke all on function public.accept_household_invitation(text) from public, anon, authenticated;
revoke all on function public.leave_household(uuid) from public, anon, authenticated;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;
grant execute on function public.leave_household(uuid) to authenticated;

commit;
begin;

create or replace function public.accept_household_invitation(invitation_token text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  target_household_id uuid;
  locked_household_id uuid;
  target_household_name text;
  current_membership_count bigint;
  updated_invitation_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 847201)
  );

  if invitation_token is null or invitation_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  select pg_catalog.lower(auth_user.email)
    into current_user_email
    from auth.users as auth_user
    where auth_user.id = current_user_id;

  select invitation.household_id
    into target_household_id
    from public.household_invitations as invitation
    where invitation.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and invitation.invited_email = current_user_email
      and invitation.status = 'pending'
      and invitation.expires_at > pg_catalog.now();

  if target_household_id is null then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  select household.id, household.name
    into locked_household_id, target_household_name
    from public.households as household
    where household.id = target_household_id
    for key share of household;

  if locked_household_id is null then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  select invitation.household_id
    into target_household_id
    from public.household_invitations as invitation
    where invitation.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and invitation.invited_email = current_user_email
      and invitation.status = 'pending'
      and invitation.expires_at > pg_catalog.now()
    for update of invitation;

  if target_household_id is null or target_household_id <> locked_household_id then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  if not exists (
    select 1
      from public.household_members as existing_membership
      where existing_membership.household_id = target_household_id
        and existing_membership.user_id = current_user_id
  ) then
    select pg_catalog.count(*)
      into current_membership_count
      from public.household_members as membership
      where membership.user_id = current_user_id;

    if current_membership_count >= 3 then
      raise exception 'Household limit reached.';
    end if;

    insert into public.household_members (household_id, user_id, role)
      values (target_household_id, current_user_id, 'member')
      on conflict on constraint household_members_pkey do nothing;
  end if;

  update public.household_invitations as invitation
    set status = 'accepted',
        accepted_at = pg_catalog.now()
    where invitation.token_hash = pg_catalog.encode(
        pg_catalog.sha256(pg_catalog.convert_to(invitation_token, 'UTF8')),
        'hex'
      )
      and invitation.household_id = target_household_id
      and invitation.invited_email = current_user_email
      and invitation.status = 'pending'
      and invitation.expires_at > pg_catalog.now();

  get diagnostics updated_invitation_count = row_count;
  if updated_invitation_count <> 1 then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  return query
    select locked_household_id, target_household_name;
end;
$$;

create or replace function public.delete_household(
  target_household_id uuid,
  confirmation_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_household_owner_id uuid;
  current_household_name text;
  current_membership_role text;
  deleted_household_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_household_id is null then
    raise exception 'Household not found.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  select household.owner_id, household.name
    into current_household_owner_id, current_household_name
    from public.households as household
    where household.id = target_household_id
    for update of household;

  if current_household_owner_id is null then
    raise exception 'Household not found.';
  end if;

  select membership.role
    into current_membership_role
    from public.household_members as membership
    where membership.household_id = target_household_id
      and membership.user_id = current_user_id;

  if current_household_owner_id <> current_user_id
    or current_membership_role is distinct from 'owner'
  then
    raise exception 'Only the household owner can delete the household.';
  end if;

  if confirmation_name is null
    or pg_catalog.btrim(confirmation_name) <> pg_catalog.btrim(current_household_name)
  then
    raise exception 'Household confirmation does not match.';
  end if;

  delete from public.households as household
    where household.id = target_household_id
      and household.owner_id = current_user_id;

  get diagnostics deleted_household_count = row_count;
  if deleted_household_count <> 1 then
    raise exception 'Unexpected error.';
  end if;
end;
$$;

revoke delete on public.households from authenticated;

revoke all on function public.accept_household_invitation(text) from public, anon, authenticated;
revoke all on function public.delete_household(uuid, text) from public, anon, authenticated;

grant execute on function public.accept_household_invitation(text) to authenticated;
grant execute on function public.delete_household(uuid, text) to authenticated;

commit;
begin;

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint recipes_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint recipes_description_length check (
    description is null or char_length(description) <= 2000
  )
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  name text not null,
  quantity numeric(12, 3),
  unit text,
  category text not null default 'other',
  sort_order integer not null default 0,
  created_at timestamptz not null default pg_catalog.now(),
  constraint recipe_items_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint recipe_items_quantity_positive check (quantity is null or quantity > 0),
  constraint recipe_items_unit check (
    unit is null or unit in ('szt.', 'kg', 'g', 'l', 'ml', 'opak.')
  ),
  constraint recipe_items_category check (
    category in (
      'produce', 'bakery', 'dairy', 'meat_fish', 'groceries', 'frozen',
      'snacks', 'drinks', 'hygiene', 'home', 'other'
    )
  ),
  constraint recipe_items_sort_order_nonnegative check (sort_order >= 0)
);

create index recipes_household_id_name_idx on public.recipes (household_id, name);
create index recipe_items_recipe_id_sort_order_idx
  on public.recipe_items (recipe_id, sort_order);

create trigger recipes_updated_at before update on public.recipes
  for each row execute function public.set_updated_at();

alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;

revoke all on public.recipes, public.recipe_items from anon, authenticated;
grant select, delete on public.recipes to authenticated;
grant select on public.recipe_items to authenticated;

create policy "Household members can read recipes"
  on public.recipes for select to authenticated
  using (public.is_household_member(household_id));
create policy "Household members can create recipes"
  on public.recipes for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = (select auth.uid())
  );
create policy "Household members can update recipes"
  on public.recipes for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "Household members can delete recipes"
  on public.recipes for delete to authenticated
  using (public.is_household_member(household_id));

create policy "Household members can read recipe items"
  on public.recipe_items for select to authenticated
  using (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );
create policy "Household members can create recipe items"
  on public.recipe_items for insert to authenticated
  with check (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );
create policy "Household members can update recipe items"
  on public.recipe_items for update to authenticated
  using (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );
create policy "Household members can delete recipe items"
  on public.recipe_items for delete to authenticated
  using (
    exists (
      select 1
      from public.recipes as recipe
      where recipe.id = recipe_items.recipe_id
        and public.is_household_member(recipe.household_id)
    )
  );

create or replace function public.save_recipe(
  target_household_id uuid,
  target_recipe_id uuid,
  target_name text,
  target_description text,
  target_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  existing_household_id uuid;
  saved_recipe_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_household_id is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Household unavailable.';
  end if;

  if target_name is null
    or pg_catalog.char_length(pg_catalog.btrim(target_name)) not between 1 and 120
  then
    raise exception 'Recipe name is invalid.';
  end if;

  if target_description is not null
    and pg_catalog.char_length(pg_catalog.btrim(target_description)) > 2000
  then
    raise exception 'Recipe description is too long.';
  end if;

  if target_items is null or pg_catalog.jsonb_typeof(target_items) <> 'array' then
    raise exception 'Recipe ingredients are invalid.';
  end if;
  if pg_catalog.jsonb_array_length(target_items) not between 1 and 100 then
    raise exception 'A recipe must have between 1 and 100 ingredients.';
  end if;

  if target_recipe_id is null then
    insert into public.recipes (household_id, name, description, created_by)
    values (
      target_household_id,
      pg_catalog.btrim(target_name),
      nullif(pg_catalog.btrim(target_description), ''),
      current_user_id
    )
    returning id into saved_recipe_id;
  else
    select recipe.household_id
      into existing_household_id
      from public.recipes as recipe
      where recipe.id = target_recipe_id
      for update of recipe;

    if existing_household_id is distinct from target_household_id
      or not public.is_household_member(existing_household_id)
    then
      raise exception 'Recipe unavailable.';
    end if;

    update public.recipes as recipe
      set name = pg_catalog.btrim(target_name),
          description = nullif(pg_catalog.btrim(target_description), '')
      where recipe.id = target_recipe_id;
    saved_recipe_id := target_recipe_id;

    delete from public.recipe_items as recipe_item
      where recipe_item.recipe_id = saved_recipe_id;
  end if;

  insert into public.recipe_items (
    recipe_id, name, quantity, unit, category, sort_order
  )
  select
    saved_recipe_id,
    pg_catalog.btrim(item.name),
    item.quantity,
    item.unit,
    item.category,
    item.sort_order
  from pg_catalog.jsonb_to_recordset(target_items) as item(
    name text,
    quantity numeric,
    unit text,
    category text,
    sort_order integer
  );

  return saved_recipe_id;
end;
$$;

create or replace function public.add_recipe_to_active_shopping_list(target_recipe_id uuid)
returns table (items_added integer, list_id uuid, list_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_household_id uuid;
  locked_household_id uuid;
  target_list_id uuid;
  target_list_name text;
  inserted_item_count integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select recipe.household_id
    into target_household_id
    from public.recipes as recipe
    where recipe.id = target_recipe_id;

  if target_household_id is null
    or not public.is_household_member(target_household_id)
  then
    raise exception 'Recipe unavailable.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_household_id::text, 0)
  );

  select recipe.household_id
    into locked_household_id
    from public.recipes as recipe
    where recipe.id = target_recipe_id
    for share of recipe;

  if locked_household_id is distinct from target_household_id
    or not public.is_household_member(locked_household_id)
  then
    raise exception 'Recipe unavailable.';
  end if;

  select active_list.list_id, active_list.list_name
    into target_list_id, target_list_name
    from public.ensure_active_shopping_list(target_household_id) as active_list;

  if target_list_id is null then
    raise exception 'Active shopping list unavailable.';
  end if;

  insert into public.shopping_items (
    list_id, name, quantity, unit, category, created_by
  )
  select
    target_list_id,
    recipe_item.name,
    recipe_item.quantity,
    recipe_item.unit,
    recipe_item.category,
    current_user_id
  from public.recipe_items as recipe_item
  where recipe_item.recipe_id = target_recipe_id
  order by recipe_item.sort_order, recipe_item.id;

  get diagnostics inserted_item_count = row_count;
  if inserted_item_count = 0 then
    raise exception 'Recipe has no ingredients.';
  end if;

  return query
    select inserted_item_count, target_list_id, target_list_name;
end;
$$;

revoke all on function public.save_recipe(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.add_recipe_to_active_shopping_list(uuid)
  from public, anon, authenticated;
grant execute on function public.save_recipe(uuid, uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.add_recipe_to_active_shopping_list(uuid)
  to authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['recipes', 'recipe_items'] loop
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

commit;
begin;

alter table public.household_invitations enable row level security;

revoke insert on table public.household_invitations
  from public, anon, authenticated;

drop policy if exists "Owners can create household invitations"
  on public.household_invitations;

create or replace function public.create_household_invitation(
  target_household_id uuid,
  target_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  normalized_email text := pg_catalog.lower(pg_catalog.btrim(target_email));
  invite_token text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if normalized_email is null
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or pg_catalog.char_length(normalized_email) > 254
  then
    raise exception 'Enter a valid email address.';
  end if;

  if not exists (
    select 1
      from public.households as household
      join public.household_members as membership
        on membership.household_id = household.id
        and membership.user_id = current_user_id
        and membership.role = 'owner'
      where household.id = target_household_id
        and household.owner_id = current_user_id
  ) then
    raise exception 'Household unavailable.';
  end if;

  select pg_catalog.lower(auth_user.email)
    into current_user_email
    from auth.users as auth_user
    where auth_user.id = current_user_id;

  if normalized_email = current_user_email then
    raise exception 'You cannot invite your own account.';
  end if;

  if not exists (
    select 1
      from auth.users as auth_user
      where pg_catalog.lower(auth_user.email) = normalized_email
  ) then
    raise exception 'No account exists for this email address.';
  end if;

  if exists (
    select 1
      from public.household_members as membership
      join auth.users as auth_user on auth_user.id = membership.user_id
      where membership.household_id = target_household_id
        and pg_catalog.lower(auth_user.email) = normalized_email
  ) then
    raise exception 'This account is already a household member.';
  end if;

  update public.household_invitations as invitation
    set status = 'cancelled'
    where invitation.household_id = target_household_id
      and invitation.invited_email = normalized_email
      and invitation.status = 'pending';

  invite_token :=
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '')
    || pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');

  insert into public.household_invitations (
    household_id,
    invited_email,
    invited_by,
    token_hash
  )
  values (
    target_household_id,
    normalized_email,
    current_user_id,
    pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(invite_token, 'UTF8')),
      'hex'
    )
  );

  return invite_token;
end;
$$;

revoke all on function public.create_household_invitation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_household_invitation(uuid, text)
  to authenticated;

commit;
