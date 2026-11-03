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
