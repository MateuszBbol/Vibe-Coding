begin;

-- Shorter invitation codes: 8 characters shown as "ABCD-EFGH".
--   * Alphabet without look-alike characters (no 0/O, 1/I/L): 31 symbols, ~40 bits.
--   * A code still only works for the invited account's email, expires after
--     7 days and is stored as a SHA-256 hash, so guessing someone else's code
--     gives nothing: the email must match the signed-in account.
--   * Case, spaces and dashes are ignored when accepting a code.
--   * Codes created before this migration (64 hex characters) keep working.

create or replace function public.normalize_household_invitation_code(raw_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when raw_code is null then null
    -- legacy 64-character hex tokens
    when pg_catalog.lower(pg_catalog.btrim(raw_code)) ~ '^[0-9a-f]{64}$'
      then pg_catalog.lower(pg_catalog.btrim(raw_code))
    -- short codes: ignore case, spaces and dashes
    when pg_catalog.upper(pg_catalog.regexp_replace(raw_code, '[[:space:]-]', '', 'g'))
         ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'
      then pg_catalog.upper(pg_catalog.regexp_replace(raw_code, '[[:space:]-]', '', 'g'))
    else null
  end;
$$;

revoke all on function public.normalize_household_invitation_code(text) from public, anon, authenticated;

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
  code_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  invite_code text;
  attempt integer := 0;
  position_index integer;
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

  loop
    attempt := attempt + 1;
    -- Random bytes from two v4 UUIDs, skipping the fixed version/variant bytes.
    random_bytes :=
      pg_catalog.substr(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()), 1, 6)
      || pg_catalog.substr(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()), 10, 7);
    invite_code := '';
    for position_index in 0..7 loop
      invite_code := invite_code || pg_catalog.substr(
        code_alphabet,
        (pg_catalog.get_byte(random_bytes, position_index) % 31) + 1,
        1
      );
    end loop;

    begin
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
          pg_catalog.sha256(pg_catalog.convert_to(invite_code, 'UTF8')),
          'hex'
        )
      );
      exit;
    exception when unique_violation then
      -- An earlier invitation already used this code: draw a new one.
      if attempt >= 5 then
        raise exception 'Could not create an invitation code. Try again.';
      end if;
    end;
  end loop;

  -- Shown to people as ABCD-EFGH; the dash is ignored when accepting.
  return pg_catalog.substr(invite_code, 1, 4) || '-' || pg_catalog.substr(invite_code, 5, 4);
end;
$$;

revoke all on function public.create_household_invitation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_household_invitation(uuid, text)
  to authenticated;

create or replace function public.accept_household_invitation(invitation_token text)
returns table (household_id uuid, household_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_user_email text;
  normalized_code text := public.normalize_household_invitation_code(invitation_token);
  code_hash text;
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

  if normalized_code is null then
    raise exception 'Invitation is invalid or unavailable.';
  end if;

  code_hash := pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(normalized_code, 'UTF8')),
    'hex'
  );

  select pg_catalog.lower(auth_user.email)
    into current_user_email
    from auth.users as auth_user
    where auth_user.id = current_user_id;

  select invitation.household_id
    into target_household_id
    from public.household_invitations as invitation
    where invitation.token_hash = code_hash
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
    where invitation.token_hash = code_hash
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
    where invitation.token_hash = code_hash
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

revoke all on function public.accept_household_invitation(text) from public, anon, authenticated;
grant execute on function public.accept_household_invitation(text) to authenticated;

commit;
