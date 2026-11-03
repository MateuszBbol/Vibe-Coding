import { getAuthRouteGuards, getAuthStatus, getIndexRedirectTarget } from './routing';

describe('auth routing during session bootstrap', () => {
  it('keeps /recipes available and redirects nowhere while auth is loading', () => {
    const status = getAuthStatus(true, false);

    expect(status).toBe('loading');
    expect(getAuthRouteGuards(true, status)).toEqual({ auth: true, app: true });
    expect(getIndexRedirectTarget(true, status)).toBeNull();
  });

  it('keeps an authenticated session on /recipes after restore', () => {
    const status = getAuthStatus(false, true);

    expect(getAuthRouteGuards(true, status).app).toBe(true);
    expect(getIndexRedirectTarget(true, status)).toBe('/(app)/home');
  });

  it('keeps an authenticated session on /households after restore', () => {
    expect(getAuthRouteGuards(true, getAuthStatus(false, true)).app).toBe(true);
  });

  it('keeps authenticated recipe details and edit routes available', () => {
    const status = getAuthStatus(false, true);

    expect(getAuthRouteGuards(true, status).app).toBe(true);
  });

  it('keeps authenticated household details available', () => {
    expect(getAuthRouteGuards(true, getAuthStatus(false, true)).app).toBe(true);
  });

  it('routes an unauthenticated user to login after initialization', () => {
    const status = getAuthStatus(false, false);
    const guards = getAuthRouteGuards(true, status);

    expect(guards.app).toBe(false);
    expect(guards.auth).toBe(true);
    expect(getIndexRedirectTarget(true, status)).toBe('/(auth)/login');
  });

  it('routes a fresh successful login from the auth group to home', () => {
    const status = getAuthStatus(false, true);
    const guards = getAuthRouteGuards(true, status);

    expect(guards.auth).toBe(false);
    expect(guards.app).toBe(true);
    expect(getIndexRedirectTarget(true, status)).toBe('/(app)/home');
  });

  it('routes sign-out to login without changing signed-out behavior', () => {
    const status = getAuthStatus(false, false);

    expect(getAuthRouteGuards(true, status)).toEqual({ auth: true, app: false });
    expect(getIndexRedirectTarget(true, status)).toBe('/(auth)/login');
  });

  it('does not send an INITIAL_SESSION restore from a nested route to home', () => {
    const status = getAuthStatus(true, true);

    expect(status).toBe('loading');
    expect(getAuthRouteGuards(true, status).app).toBe(true);
    expect(getIndexRedirectTarget(true, status)).toBeNull();
  });
});
