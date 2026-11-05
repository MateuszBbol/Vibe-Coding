import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { AuthFrame, authStyles } from '@/features/auth/AuthFrame';
import { getAuthErrorMessage } from '@/features/auth/errors';
import { fetchProfileDisplayName } from '@/features/auth/profile';
import { ProfileSetupForm } from '@/features/auth/ProfileSetupForm';
import { useSession } from '@/features/auth/SessionProvider';
import { useHouseholds } from '@/features/households/useHouseholds';
import { getFeatureErrorMessage, logFeatureError } from '@/features/errors';
import { HouseholdSetup } from '@/features/households/HouseholdSetup';
import { fetchActiveShoppingList } from '@/features/shopping/data';
import { ShoppingHome } from '@/features/shopping/ShoppingHome';
import { Colors, Spacing } from '@/constants/theme';
import { strings } from '@/localization';
import { supabase } from '@/lib/supabase/client';

export default function SignedInScreen() {
  const { isConfigured, session, signOut } = useSession();
  const queryClient = useQueryClient();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const text = strings.pl;
  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfileDisplayName(userId ?? ''),
    enabled: isConfigured && Boolean(userId),
  });
  const {
    households,
    membershipsQuery: householdQuery,
    activeHouseholdId: householdId,
    activeHousehold,
    activeSelectionQuery,
    selectActiveHousehold,
  } = useHouseholds({
    enabled: Boolean(isConfigured && userId && profileQuery.data && !profileQuery.isError),
  });
  useEffect(() => {
    if (profileQuery.isError) {
      logFeatureError('[auth] load profile failed', profileQuery.error, { userId });
    }
  }, [profileQuery.error, profileQuery.isError, userId]);
  useEffect(() => {
    if (!userId) {
      return;
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void queryClient.invalidateQueries({ queryKey: ['households', userId] });
        void queryClient.invalidateQueries({ queryKey: ['active-shopping-list', userId] });
      }
    });
    return () => subscription.remove();
  }, [queryClient, userId]);
  const completeHouseholdSetup = async (selectedHouseholdId: string) => {
    await householdQuery.refetch();
    await selectActiveHousehold(selectedHouseholdId);
  };
  const listQuery = useQuery({
    queryKey: ['active-shopping-list', userId, householdId],
    queryFn: () => fetchActiveShoppingList(householdId ?? ''),
    enabled: Boolean(householdId),
  });
  useEffect(() => {
    if (!supabase || !householdId || !userId) {
      return;
    }
    const client = supabase;
    const channel = client
      .channel(`shopping-lists:${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_lists' }, () => {
        void queryClient.invalidateQueries({
          queryKey: ['active-shopping-list', userId, householdId],
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logFeatureError('[realtime] shopping lists subscription failed', status, {
            userId,
            householdId,
          });
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [householdId, queryClient, userId]);
  useEffect(() => {
    if (listQuery.isError) {
      logFeatureError('[shopping list] load active list failed', listQuery.error, {
        userId,
        householdId,
      });
    }
  }, [householdId, listQuery.error, listQuery.isError, userId]);

  const handleSignOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      setSignOutError(getAuthErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  };

  const retryScreen = (
    title: string,
    description: string,
    retry: () => void,
    error: unknown,
    errorMessage = getFeatureErrorMessage(error),
  ) => (
    <AuthFrame title={title} description={description} testID="home-error-screen">
      <Text
        accessibilityRole="alert"
        testID="home-error-message"
        style={[authStyles.message, styles.error]}
      >
        {errorMessage}
      </Text>
      <Pressable
        accessibilityRole="button"
        testID="home-retry-button"
        onPress={retry}
        style={({ pressed }) => [
          authStyles.button,
          { backgroundColor: colors.accent, opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text
          style={[authStyles.buttonText, { color: colorScheme === 'dark' ? '#151915' : '#FFFFFF' }]}
        >
          {text.auth.retry}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID="profile-logout-button"
        onPress={() => void handleSignOut()}
        style={authStyles.linkButton}
      >
        <Text style={[authStyles.linkText, { color: colors.accent }]}>{text.auth.signOut}</Text>
      </Pressable>
      {signOutError ? (
        <Text
          accessibilityRole="alert"
          testID="profile-logout-error-message"
          style={[authStyles.message, styles.error]}
        >
          {signOutError}
        </Text>
      ) : null}
    </AuthFrame>
  );

  if (!session) {
    return null;
  }

  if (
    profileQuery.isPending ||
    (profileQuery.data && (householdQuery.isPending || activeSelectionQuery.isPending))
  ) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator testID="home-profile-loading" color={colors.accent} size="large" />
      </View>
    );
  }

  if (profileQuery.isError) {
    return retryScreen(
      text.auth.profileTitle,
      text.shopping.loadError,
      () => void profileQuery.refetch(),
      profileQuery.error,
    );
  }

  if (!profileQuery.data) {
    return <ProfileSetupForm />;
  }

  if (householdQuery.isError) {
    return retryScreen(
      text.household.setupTitle,
      text.shopping.loadError,
      () => void householdQuery.refetch(),
      householdQuery.error,
    );
  }

  if (households.length === 0 || !activeHousehold) {
    return (
      <HouseholdSetup emptyState userId={session.user.id} onCompleted={completeHouseholdSetup} />
    );
  }

  if (listQuery.isPending) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator testID="home-shopping-list-loading" color={colors.accent} size="large" />
        <Text style={[styles.loadingText, { color: colors.secondaryText }]}>
          {text.shopping.loading}
        </Text>
      </View>
    );
  }

  if (listQuery.isError) {
    return retryScreen(
      text.appName,
      text.shopping.listSetupError,
      () => void listQuery.refetch(),
      listQuery.error,
    );
  }

  return (
    <ShoppingHome
      household={activeHousehold}
      list={listQuery.data}
      userId={session.user.id}
      displayName={profileQuery.data}
      onSignOut={() => void handleSignOut()}
      isSigningOut={isSigningOut}
      signOutError={signOutError}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  loadingText: {
    marginTop: Spacing.two,
    fontSize: 14,
  },
  error: {
    color: '#B42318',
  },
});
