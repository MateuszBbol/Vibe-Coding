import { householdNameSchema, invitationEmailSchema, invitationTokenSchema } from './schemas';

describe('householdNameSchema', () => {
  it('trims and accepts a non-empty shopping list name', () => {
    expect(householdNameSchema.parse('  Nasze Zakupy  ')).toBe('Nasze Zakupy');
  });

  it('rejects empty or oversized names', () => {
    expect(householdNameSchema.safeParse('  ')).toMatchObject({
      success: false,
      error: { issues: [{ message: 'Wpisz nazwę listy zakupowej.' }] },
    });
    expect(householdNameSchema.safeParse('x'.repeat(81)).success).toBe(false);
  });
});

describe('invitation validation', () => {
  it('normalizes a valid email address', () => {
    expect(invitationEmailSchema.parse('  Friend@Example.com ')).toBe('friend@example.com');
  });

  it('accepts a token generated from two UUIDs without separators', () => {
    const generatedToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    expect(invitationTokenSchema.parse(generatedToken)).toBe(generatedToken);
    expect(invitationTokenSchema.safeParse('not-a-token').success).toBe(false);
  });

  it('extracts the token when a previously shared invitation message is pasted', () => {
    const generatedToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    expect(
      invitationTokenSchema.parse(`Udostępnianie listy „Nasze Zakupy”\n${generatedToken}`),
    ).toBe(generatedToken);
  });
});
