import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type AuthFrameProps = PropsWithChildren<{
  title: string;
  description: string;
  testID?: string;
}>;

export function AuthFrame({ title, description, testID, children }: AuthFrameProps) {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Colors[colorScheme];

  return (
    <SafeAreaView
      testID={testID}
      style={[authStyles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={authStyles.content} keyboardShouldPersistTaps="handled">
        <View style={[authStyles.mark, { backgroundColor: colors.accentSoft }]}>
          <Text style={[authStyles.markText, { color: colors.accent }]} accessible={false}>
            N
          </Text>
        </View>
        <Text accessibilityRole="header" style={[authStyles.title, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[authStyles.description, { color: colors.secondaryText }]}>{description}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const authStyles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  safeArea: {
    flex: 1,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  markText: {
    fontSize: 24,
    fontWeight: '700',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: Spacing.four,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: Spacing.two,
  },
  linkButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  address: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: Spacing.one,
  },
});
