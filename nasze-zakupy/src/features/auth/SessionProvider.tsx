import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { getAuthErrorMessage } from '@/features/auth/errors';
import { getAuthStatus } from '@/features/auth/routing';
import type { AuthStatus } from '@/features/auth/routing';
import { logFeatureError } from '@/features/errors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';

type SessionContextValue = {
  session: Session | null;
  authStatus: AuthStatus;
  isLoading: boolean;
  isConfigured: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState<string | null>(null);
  const authStatus = getAuthStatus(isLoading, Boolean(session));
  useEffect(() => {
    const client = supabase;
    if (!client) {
      return;
    }

    let isMounted = true;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }
      setSession(nextSession);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
      }
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setAuthError(null);
      }
    });

    const initializeSession = async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          throw error;
        }
        if (isMounted) {
          setSession(data.session);
        }
      } catch (error) {
        logFeatureError('[auth] restore session failed', error);
        if (isMounted) {
          setAuthError(getAuthErrorMessage(error));
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initializeSession();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        client.auth.startAutoRefresh();
      } else {
        client.auth.stopAutoRefresh();
      }
    });
    if (AppState.currentState === 'active') {
      client.auth.startAutoRefresh();
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      appStateSubscription.remove();
      client.auth.stopAutoRefresh();
    };
  }, [queryClient]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      throw new Error('Brak konfiguracji Supabase.');
    }
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, []);

  return (
    <SessionContext.Provider
      value={{
        session,
        authStatus,
        isLoading,
        isConfigured: isSupabaseConfigured,
        authError,
        clearAuthError,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession musi być użyty wewnątrz SessionProvider.');
  }
  return value;
}
