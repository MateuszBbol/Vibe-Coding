import { profileSchema } from './profileSchema';

describe('profileSchema', () => {
  it('trims and accepts a non-empty display name', () => {
    expect(profileSchema.parse({ displayName: '  Karol  ' }).displayName).toBe('Karol');
  });

  it('rejects empty names and names longer than 80 characters', () => {
    expect(profileSchema.safeParse({ displayName: '   ' }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: 'x'.repeat(81) }).success).toBe(false);
  });
});
