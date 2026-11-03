import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { ScreenHeader } from '@/components/ScreenHeader';

export function HouseholdFrame({
  title,
  onBack,
  testID,
  children,
}: PropsWithChildren<{ title: string; onBack: () => void; testID?: string }>) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];

  return (
    <SafeAreaView
      testID={testID ?? 'households-screen'}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScreenHeader title={title} onBack={onBack} borderColor={colors.border} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function HouseholdNavigationRow({
  title,
  description,
  onPress,
  testID,
}: {
  title: string;
  description?: string;
  onPress: () => void;
  testID?: string;
}) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];

  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
        {description ? (
          <Text style={[styles.description, { color: colors.secondaryText }]}>{description}</Text>
        ) : null}
      </View>
      <Text style={[styles.chevron, { color: colors.accent }]}>›</Text>
    </Pressable>
  );
}

export function HouseholdMessage({ children, testID }: PropsWithChildren<{ testID?: string }>) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  return (
    <Text testID={testID} style={[styles.message, { color: colors.secondaryText }]}>
      {children}
    </Text>
  );
}

export function HouseholdButton({
  label,
  onPress,
  disabled = false,
  destructive = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  testID?: string;
}) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const color = destructive ? '#B42318' : disabled ? colors.secondaryText : colors.accent;
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
          backgroundColor: colors.card,
          borderColor: destructive ? '#B42318' : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.five },
  row: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowText: { flex: 1, gap: Spacing.half },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20 },
  chevron: { fontSize: 28, fontWeight: '300' },
  message: { fontSize: 15, lineHeight: 22, textAlign: 'center', paddingVertical: Spacing.two },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
