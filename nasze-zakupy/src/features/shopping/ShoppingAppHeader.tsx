import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

type ShoppingAppHeaderProps = {
  userName: string;
  activeListName: string;
  noActiveListLabel: string;
  title: string;
  signOutLabel: string;
  isSigningOut: boolean;
  onSignOut: () => void;
};

export function ShoppingAppHeader({
  userName,
  activeListName,
  noActiveListLabel,
  title,
  signOutLabel,
  isSigningOut,
  onSignOut,
}: ShoppingAppHeaderProps) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.center}>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Text>
      </View>
      <View style={styles.right}>
        <View style={styles.identity}>
          <View style={styles.userNameRow}>
            <SymbolView
              name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
              tintColor={colors.accent}
              size={18}
            />
            <Text
              testID="profile-user-name"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.userName, { color: colors.text }]}
            >
              {userName}
            </Text>
          </View>
          <Text
            testID="active-shopping-list-name"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.activeListName, { color: colors.secondaryText }]}
          >
            {activeListName || noActiveListLabel}
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
            size={22}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: Spacing.two,
  },
  right: {
    width: '48%',
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 1,
  },
  userNameRow: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  userName: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  activeListName: {
    maxWidth: '100%',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    maxWidth: '48%',
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  logout: {
    width: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
