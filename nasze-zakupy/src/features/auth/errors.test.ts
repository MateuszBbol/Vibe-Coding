import { getAuthErrorMessage } from './errors';

describe('getAuthErrorMessage', () => {
  it('does not disclose whether the email or password is incorrect', () => {
    expect(getAuthErrorMessage({ code: 'invalid_credentials' })).toBe(
      'Nieprawidłowy adres e-mail lub hasło.',
    );
  });

  it('does not expose raw backend errors', () => {
    expect(getAuthErrorMessage(new Error('secret project data'))).toBe(
      'Nie udało się dokończyć logowania. Spróbuj ponownie.',
    );
  });
});
