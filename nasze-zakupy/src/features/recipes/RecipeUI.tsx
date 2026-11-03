import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';

type RecipeFrameProps = PropsWithChildren<{
  title: string;
  onBack: () => void;
  action?: ReactNode;
  testID?: string;
}>;

export function RecipeFrame({ title, onBack, action, testID, children }: RecipeFrameProps) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  return (
    <SafeAreaView
      testID={testID ?? 'recipes-screen'}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title={title} onBack={onBack} rightAction={action} borderColor="#8C9386" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type RecipeButtonProps = {
  label: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
};

export function RecipeButton({
  label,
  onPress,
  testID,
  disabled = false,
  secondary = false,
  danger = false,
}: RecipeButtonProps) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const color = danger ? '#B42318' : secondary ? colors.text : '#FFFFFF';
  const backgroundColor = secondary ? colors.card : danger ? colors.card : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor: danger ? '#B42318' : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        secondary && styles.secondaryButton,
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function RecipeCard({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {children}
    </View>
  );
}

export function RecipeError({ children, testID }: { children: string; testID?: string }) {
  return (
    <Text accessibilityRole="alert" testID={testID} style={styles.error}>
      {children}
    </Text>
  );
}

export function RecipeMessage({ children, testID }: { children: string; testID?: string }) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  return (
    <Text testID={testID} style={[styles.message, { color: colors.secondaryText }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  card: { borderWidth: 1, borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButton: { borderWidth: 1 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', padding: Spacing.three },
  error: { color: '#B42318', fontSize: 14, lineHeight: 20 },
});
