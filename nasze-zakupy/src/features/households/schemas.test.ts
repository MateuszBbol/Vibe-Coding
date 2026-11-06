import { householdNameSchema, invitationEmailSchema, invitationTokenSchema } from './schemas';

describe('householdNameSchema', () => {
  it('trims and accepts a non-empty shopping list name', () => {
    expect(householdNameSchema.parse('  Nasze Zakupy  ')).toBe('Nasze Zakupy');
  });

  it('rejects empty or oversized names', () => {
    expect(householdNameSchema.safeParse('  ')).toMatchObject({
      success: false,
      error: { issues: [{ message: 'Wpisz nazwę grupy.' }] },
    });
    expect(householdNameSchema.safeParse('x'.repeat(81)).success).toBe(false);
  });
});

describe('invitation validation', () => {
  it('normalizes a valid email address', () => {
    expect(invitationEmailSchema.parse('  Friend@Example.com ')).toBe('friend@example.com');
  });

  it('accepts a short code regardless of case, spaces and the dash', () => {
    expect(invitationTokenSchema.parse('ABCD-EFGH')).toBe('ABCDEFGH');
    expect(invitationTokenSchema.parse(' abcd efgh ')).toBe('ABCDEFGH');
    expect(invitationTokenSchema.parse('k7m2p9qr')).toBe('K7M2P9QR');
  });

  it('rejects short codes with look-alike characters or the wrong length', () => {
    expect(invitationTokenSchema.safeParse('ABCD-EFG0').success).toBe(false);
    expect(invitationTokenSchema.safeParse('ABCD-EFGI').success).toBe(false);
    expect(invitationTokenSchema.safeParse('ABCD-EFG').success).toBe(false);
    expect(invitationTokenSchema.safeParse('ABCD-EFGHJ').success).toBe(false);
  });

  it('extracts a short code from a pasted invitation message', () => {
    expect(invitationTokenSchema.parse('Udostępnianie grupy w aplikacji Home\nK7M2-P9QR')).toBe(
      'K7M2P9QR',
    );
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
