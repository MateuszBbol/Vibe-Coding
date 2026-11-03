const { readFileSync } = require('node:fs');
const { join } = require('node:path');

describe('accept_household_invitation SQL migration', () => {
  it('avoids the ambiguous household_id column in the conflict clause', () => {
    const migration = readFileSync(
      join(__dirname, '..', 'migrations', '202610280002_fix_ambiguous_household_id.sql'),
      'utf8',
    );

    expect(migration).toMatch(/on conflict on constraint household_members_pkey do nothing/i);
    expect(migration).not.toMatch(/on conflict\s*\(\s*household_id\s*,\s*user_id\s*\)/i);
    expect(migration).toMatch(
      /returns table\s*\(\s*household_id uuid,\s*household_name text\s*\)/i,
    );
    expect(migration).toMatch(/security definer[\s\S]*set search_path = ''/i);
    expect(migration).toMatch(
      /grant execute on function public\.accept_household_invitation\(text\)\s+to authenticated/i,
    );
  });
});
