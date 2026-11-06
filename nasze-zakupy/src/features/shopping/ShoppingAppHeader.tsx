import { SymbolView } from 'expo-symbols';
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';

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
  const isCompact = useWindowDimensions().width < 520;
  const listLabel = activeListName || noActiveListLabel;

  return (
    <View style={styles.container}>
      {/* Equal-width side columns keep the title centred on the screen. */}
      <View style={styles.side} />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[styles.title, isCompact && styles.compactTitle, { color: colors.text }]}
      >
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>
        {/* Read-only identity: lists are managed from the "Listy" section of the bottom bar. */}
        <View
          accessible
          accessibilityLabel={`${userName}, ${listLabel}`}
          testID="profile-identity"
          style={[styles.identity, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.identityText}>
            <View style={styles.identityRow}>
              <SymbolView
                name={{
                  ios: 'person.crop.circle',
                  android: 'account_circle',
                  web: 'account_circle',
                }}
                tintColor={colors.accent}
                size={16}
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
            <View style={styles.identityRow}>
              <SymbolView
                name={{ ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' }}
                tintColor={colors.secondaryText}
                size={14}
              />
              <Text
                testID="active-shopping-list-name"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.activeListName, { color: colors.secondaryText }]}
              >
                {listLabel}
              </Text>
            </View>
          </View>
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
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  side: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
  },
  title: {
    flexShrink: 0,
    textAlign: 'center',
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
  },
  compactTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  right: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  identity: {
    flexShrink: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  identityText: {
    flexShrink: 1,
    minWidth: 0,
    gap: 1,
  },
  identityRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  activeListName: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '500',
  },
  logout: {
    width: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
