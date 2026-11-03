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
