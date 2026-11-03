import { emailSchema, loginSchema } from './schemas';

describe('emailSchema', () => {
  it('trims whitespace and normalizes email casing', () => {
    expect(emailSchema.parse('  Karol@Example.com  ')).toBe('karol@example.com');
  });

  it('rejects invalid email addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid email and a non-empty password', () => {
    expect(loginSchema.parse({ email: '  Karol@Example.com ', password: 'passphrase' })).toEqual({
      email: 'karol@example.com',
      password: 'passphrase',
    });
  });

  it('rejects invalid email addresses and empty passwords', () => {
    expect(loginSchema.safeParse({ email: 'invalid', password: 'passphrase' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'valid@example.com', password: '' }).success).toBe(false);
  });
});
