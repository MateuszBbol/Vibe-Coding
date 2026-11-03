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
