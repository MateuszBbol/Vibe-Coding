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
