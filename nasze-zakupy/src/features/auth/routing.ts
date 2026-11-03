export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthRouteGuards = {
  auth: boolean;
  app: boolean;
};

export function getAuthStatus(isLoading: boolean, hasSession: boolean): AuthStatus {
  if (isLoading) {
    return 'loading';
  }
  return hasSession ? 'authenticated' : 'unauthenticated';
}

export function getAuthRouteGuards(isConfigured: boolean, authStatus: AuthStatus): AuthRouteGuards {
  if (!isConfigured) {
    return { auth: false, app: false };
  }
  if (authStatus === 'loading') {
    return { auth: true, app: true };
  }
  return {
    auth: authStatus === 'unauthenticated',
    app: authStatus === 'authenticated',
  };
}

export function getIndexRedirectTarget(
  isConfigured: boolean,
  authStatus: AuthStatus,
): '/(app)/home' | '/(auth)/login' | null {
  if (!isConfigured || authStatus === 'loading') {
    return null;
  }
  return authStatus === 'authenticated' ? '/(app)/home' : '/(auth)/login';
}
