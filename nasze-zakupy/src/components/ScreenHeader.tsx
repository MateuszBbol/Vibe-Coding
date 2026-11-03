import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  titleSize?: 'default' | 'large';
  borderColor?: string;
};

export function ScreenHeader({
  title,
  onBack,
  rightAction,
  titleSize = 'default',
  borderColor,
}: ScreenHeaderProps) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.header,
        borderColor
          ? { borderBottomColor: borderColor, borderBottomWidth: StyleSheet.hairlineWidth }
          : null,
      ]}
    >
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wstecz"
            testID="navigation-back-button"
            onPress={onBack}
          >
            <Text style={[styles.back, { color: colors.accent }]}>‹ Wstecz</Text>
          </Pressable>
        ) : null}
      </View>
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={[styles.title, titleSize === 'large' && styles.largeTitle, { color: colors.text }]}
      >
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{rightAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    width: 76,
    minHeight: 44,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
  },
  back: {
    fontSize: 16,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
  },
  largeTitle: {
    fontSize: 26,
    lineHeight: 31,
  },
});
