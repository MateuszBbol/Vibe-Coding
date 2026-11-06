const { readFileSync } = require('fs');
const { resolve } = require('path');

const migration = readFileSync(
  resolve(__dirname, '../migrations/202611080001_short_household_invitation_codes.sql'),
  'utf8',
).toLowerCase();

describe('short household invitation codes migration', () => {
  test('runs in one transaction with fixed search paths', () => {
    expect(migration.trim().startsWith('begin;')).toBe(true);
    expect(migration.trim().endsWith('commit;')).toBe(true);
    expect(migration.match(/set search_path = ''/g).length).toBeGreaterThanOrEqual(3);
  });

  test('generates 8-character codes from an alphabet without look-alikes', () => {
    expect(migration).toContain("code_alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789'");
    expect(migration).toContain('for position_index in 0..7 loop');
    expect(migration).toContain('% 31');
    expect(migration).toContain("|| '-' ||");
  });

  test('still stores only a SHA-256 hash and retries on a code collision', () => {
    expect(migration).toContain('pg_catalog.sha256(pg_catalog.convert_to(invite_code');
    expect(migration).toContain('exception when unique_violation then');
    expect(migration).toContain('if attempt >= 5 then');
  });

  test('accepts short codes (case, spaces and dashes ignored) and legacy 64-hex tokens', () => {
    expect(migration).toContain(
      'create or replace function public.normalize_household_invitation_code',
    );
    expect(migration).toContain("~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("'[[:space:]-]'");
    expect(migration).toContain("~ '^[abcdefghjkmnpqrstuvwxyz23456789]{8}$'");
  });

  test('keeps the invitation bound to the invited email, pending status and expiry', () => {
    expect(migration).toContain('invitation.invited_email = current_user_email');
    expect(migration).toContain("invitation.status = 'pending'");
    expect(migration).toContain('invitation.expires_at > pg_catalog.now()');
    expect(migration).toContain("raise exception 'household limit reached.'");
  });

  test('keeps both RPCs restricted to authenticated users', () => {
    expect(migration).toContain(
      'grant execute on function public.create_household_invitation(uuid, text)\n  to authenticated;',
    );
    expect(migration).toContain(
      'grant execute on function public.accept_household_invitation(text) to authenticated;',
    );
    expect(migration).toContain(
      'revoke all on function public.normalize_household_invitation_code(text) from public, anon, authenticated;',
    );
  });
});
