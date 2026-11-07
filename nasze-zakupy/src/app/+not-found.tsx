import { Stack, useRouter } from 'expo-router';
import { Pressable, Text, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { AuthFrame, authStyles } from '@/features/auth/AuthFrame';
import { strings } from '@/localization';

// Replaces Expo Router's default "Unmatched Route" screen, which is in English
// and links to the route sitemap.
export default function NotFoundScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];
  const text = strings.pl.notFound;

  return (
    <>
      <Stack.Screen options={{ title: text.title }} />
      <AuthFrame title={text.title} description={text.description} testID="not-found-screen">
        <Pressable
          accessibilityRole="button"
          testID="not-found-home-button"
          // "/" redirects to the home screen or to login, depending on the session.
          onPress={() => router.replace('/')}
          style={({ pressed }) => [
            authStyles.button,
            { backgroundColor: colors.accent, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text
            style={[
              authStyles.buttonText,
              { color: colorScheme === 'dark' ? '#151915' : '#FFFFFF' },
            ]}
          >
            {text.goHome}
          </Text>
        </Pressable>
      </AuthFrame>
    </>
  );
}
