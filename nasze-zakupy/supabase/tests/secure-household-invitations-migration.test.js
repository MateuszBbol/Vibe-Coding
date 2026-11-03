const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const readMigration = (name) => readFileSync(join(__dirname, '..', 'migrations', name), 'utf8');

const secureMigration = readMigration('202610280007_secure_household_invitations.sql');
const initialMigration = readMigration('202610270001_initial_auth_and_households.sql');
const invitationRpcMigration = readMigration(
  '202610280001_household_invitation_and_active_list_rpcs.sql',
);
const finalInvitationAcceptanceMigration = readMigration('202610280005_delete_household_rpc.sql');

const compact = (sql) => sql.replace(/\s+/g, '').toLowerCase();
const createFunction = secureMigration.match(
  /create or replace function public\.create_household_invitation\([\s\S]*?^\$\$;/im,
)?.[0];
const acceptanceFunction = finalInvitationAcceptanceMigration.match(
  /create or replace function public\.accept_household_invitation\([\s\S]*?^\$\$;/im,
)?.[0];

describe('secure household invitations migration contract', () => {
  it('removes direct INSERT privilege and the direct-insert RLS policy while keeping RLS enabled', () => {
    const normalized = compact(secureMigration);

    expect(normalized).toContain('altertablepublic.household_invitationsenablerowlevelsecurity;');
    expect(normalized).toMatch(
      /revokeinsertontablepublic\.household_invitationsfrompublic,anon,authenticated;/,
    );
    expect(normalized).toContain(
      'droppolicyifexists"ownerscancreatehouseholdinvitations"onpublic.household_invitations;',
    );
    expect(normalized).not.toMatch(
      /grantinsert(?:\([^)]*\))?on(?:table)?public\.household_invitations/,
    );
    expect(normalized).not.toMatch(/createpolicy[^;]*onpublic\.household_invitationsforinsert/);
  });

  it('preserves owner-only invitation reads and the restricted status update', () => {
    const normalizedInitial = compact(initialMigration);
    const normalizedSecure = compact(secureMigration);

    expect(normalizedInitial).toContain(
      'grantselect(id,household_id,invited_email,invited_by,status,expires_at,accepted_at,created_at)onpublic.household_invitationstoauthenticated;',
    );
    expect(normalizedInitial).toContain(
      'createpolicy"ownerscanreadhouseholdinvitations"onpublic.household_invitationsforselecttoauthenticatedusing(public.is_household_owner(household_id));',
    );
    expect(normalizedInitial).toContain(
      'grantupdate(status)onpublic.household_invitationstoauthenticated;',
    );
    expect(normalizedInitial).toContain(
      'createpolicy"ownerscancancelpendinghouseholdinvitations"onpublic.household_invitationsforupdatetoauthenticated',
    );
    expect(normalizedSecure).not.toMatch(
      /revoke(?:all|select|update|delete)[^;]*on(?:table)?public\.household_invitations/,
    );
  });

  it('limits invitation creation RPC execution to authenticated users', () => {
    const normalized = compact(secureMigration);

    expect(normalized).toContain(
      'revokeallonfunctionpublic.create_household_invitation(uuid,text)frompublic,anon,authenticated;',
    );
    expect(normalized).toContain(
      'grantexecuteonfunctionpublic.create_household_invitation(uuid,text)toauthenticated;',
    );
  });

  it('validates the authenticated owner, email and stored token hash inside the RPC', () => {
    expect(createFunction).toBeDefined();
    expect(createFunction).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(createFunction).toMatch(/auth\.uid\(\)/i);
    expect(createFunction).toMatch(/household\.owner_id = current_user_id/i);
    expect(createFunction).toMatch(/membership\.role = 'owner'/i);
    expect(createFunction).toMatch(/pg_catalog\.lower\(pg_catalog\.btrim\(target_email\)\)/i);
    expect(createFunction).toMatch(/pg_catalog\.lower\(auth_user\.email\)/i);
    expect(createFunction).toMatch(/pg_catalog\.gen_random_uuid\(\)/i);
    expect(createFunction).toMatch(/pg_catalog\.sha256\(/i);
    expect(createFunction).toMatch(/token_hash/i);
    expect(createFunction).toMatch(/status = 'pending'/i);
    expect(createFunction).toMatch(
      /insert into public\.household_invitations\s*\([\s\S]*?invited_email,[\s\S]*?token_hash/i,
    );
    expect(createFunction).not.toMatch(/token_hash\s*,\s*status|expires_at/i);
    expect(initialMigration).toMatch(/status text not null default 'pending'/i);
    expect(initialMigration).toMatch(
      /expires_at timestamptz not null default \(pg_catalog\.now\(\) \+ interval '7 days'\)/i,
    );
    expect(invitationRpcMigration).toMatch(
      /grant execute on function public\.create_household_invitation\(uuid, text\) to authenticated/i,
    );
  });

  it('allows owners through the RPC and blocks members by requiring both owner identities', () => {
    expect(createFunction).toMatch(
      /join public\.household_members as membership[\s\S]*membership\.user_id = current_user_id[\s\S]*membership\.role = 'owner'[\s\S]*household\.owner_id = current_user_id/i,
    );
    expect(createFunction).toMatch(/raise exception 'Household unavailable\.'/i);
  });

  it('keeps acceptance bound to the invited email, pending unexpired token and authenticated user', () => {
    expect(acceptanceFunction).toBeDefined();
    expect(acceptanceFunction).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(acceptanceFunction).toMatch(/auth\.uid\(\)/i);
    expect(acceptanceFunction).toMatch(/invitation\.token_hash/i);
    expect(acceptanceFunction).toMatch(/invitation\.invited_email = current_user_email/i);
    expect(acceptanceFunction).toMatch(/invitation\.status = 'pending'/i);
    expect(acceptanceFunction).toMatch(/invitation\.expires_at > pg_catalog\.now\(\)/i);
    expect(acceptanceFunction).toMatch(/set status = 'accepted'/i);
    expect(finalInvitationAcceptanceMigration).toMatch(
      /revoke all on function public\.accept_household_invitation\(text\) from public, anon, authenticated/i,
    );
    expect(finalInvitationAcceptanceMigration).toMatch(
      /grant execute on function public\.accept_household_invitation\(text\) to authenticated/i,
    );
  });
});
