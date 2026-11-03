import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type ShoppingAppHeaderProps = {
  userName: string;
  householdName: string;
  title: string;
  signOutLabel: string;
  isSigningOut: boolean;
  onSignOut: () => void;
};

const logoutButtonWidth = 44;

export function ShoppingAppHeader({
  userName,
  householdName,
  title,
  signOutLabel,
  isSigningOut,
  onSignOut,
}: ShoppingAppHeaderProps) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const [containerWidth, setContainerWidth] = useState(0);
  const [titleWidth, setTitleWidth] = useState(0);
  const maxSideWidth = Math.max(
    0,
    (containerWidth - titleWidth - logoutButtonWidth - Spacing.two * 2) / 2,
  );

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  };
  const handleTitleLayout = (event: LayoutChangeEvent) => {
    setTitleWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container} onLayout={handleContainerLayout}>
      <View style={[styles.left, { maxWidth: maxSideWidth }]}>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.userName, { color: colors.text }]}
        >
          {userName}
        </Text>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.householdName, { color: colors.secondaryText }]}
        >
          {householdName}
        </Text>
      </View>
      <View pointerEvents="none" style={styles.center}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          onLayout={handleTitleLayout}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={signOutLabel}
        accessibilityState={{ disabled: isSigningOut }}
        testID="profile-logout-button"
        disabled={isSigningOut}
        onPress={onSignOut}
        hitSlop={8}
        style={({ pressed }) => [
          styles.logout,
          { opacity: isSigningOut ? 0.5 : pressed ? 0.65 : 1 },
        ]}
      >
        <SymbolView
          name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
          tintColor={colors.secondaryText}
          size={24}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
  },
  householdName: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    maxWidth: '60%',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  logout: {
    width: logoutButtonWidth,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
