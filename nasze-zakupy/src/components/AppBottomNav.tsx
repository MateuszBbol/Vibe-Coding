import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { strings } from '@/localization';

export type AppSection = 'shopping' | 'todo' | 'recipes' | 'lists';
export type HomeSection = 'shopping' | 'todo';

type NavItem = {
  section: AppSection;
  label: string;
  testID: string;
  href: Href;
  icon: SymbolViewProps['name'];
};

// Top-level sections. Each one has its own URL so refresh and direct links keep the section.
export const appSectionHrefs: Record<AppSection, Href> = {
  shopping: '/home',
  todo: { pathname: '/home', params: { section: 'todo' } } as Href,
  recipes: '/recipes',
  lists: '/households',
};

const items: NavItem[] = [
  {
    section: 'shopping',
    label: strings.pl.navigation.shopping,
    testID: 'home-tab-shopping',
    href: appSectionHrefs.shopping,
    icon: { ios: 'cart', android: 'shopping_cart', web: 'shopping_cart' },
  },
  {
    section: 'todo',
    label: strings.pl.navigation.todo,
    testID: 'home-tab-todo',
    href: appSectionHrefs.todo,
    icon: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  },
  {
    section: 'recipes',
    label: strings.pl.navigation.recipes,
    testID: 'navigation-recipes',
    href: appSectionHrefs.recipes,
    icon: { ios: 'book.closed', android: 'menu_book', web: 'menu_book' },
  },
  {
    section: 'lists',
    label: strings.pl.navigation.lists,
    testID: 'navigation-households',
    href: appSectionHrefs.lists,
    icon: { ios: 'list.bullet.rectangle', android: 'list_alt', web: 'list_alt' },
  },
];

export function isHomeSection(section: AppSection): section is HomeSection {
  return section === 'shopping' || section === 'todo';
}

type AppBottomNavProps = {
  active: AppSection;
  counts?: Partial<Record<AppSection, number>>;
  // On the home screen, shopping and tasks switch in place instead of reloading the screen.
  onSelectHomeSection?: (section: HomeSection) => void;
};

export function AppBottomNav({ active, counts, onSelectHomeSection }: AppBottomNavProps) {
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();

  const select = (item: NavItem) => {
    if (item.section === active) {
      return;
    }
    if (onSelectHomeSection && isHomeSection(item.section)) {
      onSelectHomeSection(item.section);
      return;
    }
    // Sections replace each other so the history does not grow with every tab switch;
    // detail screens are still pushed on top and keep their Back button.
    router.replace(item.href);
  };

  return (
    <View
      testID="app-bottom-nav"
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, Spacing.one),
        },
      ]}
    >
      <View accessibilityRole="tablist" style={styles.row}>
        {items.map((item) => {
          const selected = item.section === active;
          const count = counts?.[item.section];
          const label = count === undefined ? item.label : `${item.label} (${count})`;
          const color = selected ? colors.accent : colors.secondaryText;
          return (
            <Pressable
              key={item.section}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected }}
              aria-selected={selected}
              testID={item.testID}
              onPress={() => select(item)}
              style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View
                style={[styles.iconPill, selected ? { backgroundColor: colors.accentSoft } : null]}
              >
                <SymbolView name={item.icon} tintColor={color} size={22} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, { color }, selected ? styles.selectedLabel : null]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.one,
  },
  row: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: Spacing.half,
  },
  iconPill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectedLabel: {
    fontWeight: '700',
  },
});
