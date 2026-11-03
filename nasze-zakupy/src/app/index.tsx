import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { getIndexRedirectTarget } from '@/features/auth/routing';
import { useSession } from '@/features/auth/SessionProvider';
import { Colors, Spacing } from '@/constants/theme';
import { strings } from '@/localization';

export default function IndexScreen() {
  const { authStatus, isConfigured } = useSession();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  if (authStatus === 'loading') {
    return (
      <View
        testID="home-session-loading"
        style={[styles.centered, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!isConfigured) {
    return (
      <View
        testID="home-missing-config-screen"
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {strings.pl.auth.missingConfigTitle}
        </Text>
        <Text style={[styles.message, { color: colors.secondaryText }]}>
          {strings.pl.auth.missingConfigDescription}
        </Text>
      </View>
    );
  }

  const redirectTarget = getIndexRedirectTarget(isConfigured, authStatus);
  return redirectTarget ? <Redirect href={redirectTarget} /> : null;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
  },
});
