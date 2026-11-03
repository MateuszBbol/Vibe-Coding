import { strings } from '@/localization';

type AuthErrorShape = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return strings.pl.auth.authError;
  }

  const authError = error as AuthErrorShape;
  const code = typeof authError.code === 'string' ? authError.code.toLowerCase() : '';
  const message = typeof authError.message === 'string' ? authError.message.toLowerCase() : '';

  if (
    code === 'invalid_credentials' ||
    code === 'user_not_found' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials')
  ) {
    return strings.pl.auth.invalidCredentials;
  }

  if (authError.status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return strings.pl.auth.rateLimited;
  }

  if (
    message.includes('network request failed') ||
    message.includes('fetch failed') ||
    message.includes('network error')
  ) {
    return strings.pl.auth.noInternet;
  }

  if (
    message.includes('invalid email') ||
    message.includes('unable to validate email') ||
    code === 'email_address_invalid'
  ) {
    return strings.pl.auth.emailInvalid;
  }

  return strings.pl.auth.authError;
}
