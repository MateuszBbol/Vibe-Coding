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
