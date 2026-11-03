import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { getAuthRouteGuards } from '@/features/auth/routing';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { QueryProvider } from '@/lib/query/QueryProvider';

function RootNavigator() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const { authStatus, isConfigured } = useSession();
  const guards = getAuthRouteGuards(isConfigured, authStatus);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={styles.root}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Protected guard={guards.auth}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={guards.app}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack>
        {authStatus === 'loading' ? (
          <View
            accessibilityRole="progressbar"
            testID="auth-session-loading"
            style={[styles.loading, { backgroundColor: colors.background }]}
          >
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : null}
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryProvider>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
