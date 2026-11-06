const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../../src');
const shopping = readFileSync(resolve(root, 'features/shopping/ShoppingHome.tsx'), 'utf8');
const home = readFileSync(resolve(root, 'app/(app)/home.tsx'), 'utf8');
const shoppingHeader = readFileSync(
  resolve(root, 'features/shopping/ShoppingAppHeader.tsx'),
  'utf8',
);
const recipeList = readFileSync(resolve(root, 'app/(app)/recipes/index.tsx'), 'utf8');
const recipeUI = readFileSync(resolve(root, 'features/recipes/RecipeUI.tsx'), 'utf8');
const householdUI = readFileSync(resolve(root, 'features/households/HouseholdUI.tsx'), 'utf8');
const screenHeader = readFileSync(resolve(root, 'components/ScreenHeader.tsx'), 'utf8');
const localization = readFileSync(resolve(root, 'localization/index.ts'), 'utf8');
const recipeRoutes = readFileSync(resolve(root, 'features/recipes/routes.ts'), 'utf8');
const householdRoutes = readFileSync(resolve(root, 'features/households/routes.ts'), 'utf8');

describe('screen layout contract', () => {
  it('keeps one create action and a text-only empty state for recipes', () => {
    expect(recipeList.match(/RecipeButton label={text\.create}/g)).toHaveLength(1);
    expect(recipeList).not.toContain('text.firstRecipe');
    expect(localization).not.toContain('firstRecipe:');
    expect(localization).toContain("create: 'Nowy przepis'");
    expect(localization).toContain("create: 'New recipe'");
  });

  it('uses one compact navigation row with section tabs, recipes and a list menu', () => {
    expect(shopping).not.toContain('styles.navigationButtons');
    expect(shopping).not.toContain('<ScreenHeader');
    expect(shopping.indexOf('testID="home-tab-shopping"')).toBeLessThan(
      shopping.indexOf('testID="navigation-recipes"'),
    );
    expect(shopping.indexOf('testID="navigation-recipes"')).toBeLessThan(
      shopping.indexOf('testID="shopping-list-menu-button"'),
    );
    expect(shopping).toContain('router.push(recipeRoutes.list(household.id))');
    expect(shopping).toContain('onSwitchList={() => router.push(householdRoutes.root())}');
    expect(shopping).toContain('style={styles.tabsRow}');
    expect(shopping).toContain('minHeight: 40');
    expect(shopping).toContain('testID="home-tab-shopping"');
    expect(shopping).toContain('testID="home-tab-todo"');
  });

  it('keeps secondary list actions in the menu and destructive actions out of it', () => {
    expect(shopping).toContain('testID="shopping-menu-share"');
    expect(shopping).toContain('{isOwner ? (');
    expect(shopping).toContain('householdRoutes.invitations(household.id)');
    expect(shopping).toContain('testID="shopping-menu-settings"');
    expect(shopping).toContain('householdRoutes.details(household.id)');
    expect(shopping).not.toContain('deleteHousehold');
    expect(shopping).not.toContain('deleteShoppingList');
  });

  it('shares a centered header between recipe and household screens', () => {
    expect(recipeUI).toContain('<ScreenHeader title={title} onBack={onBack}');
    expect(householdUI).toContain('<ScreenHeader title={title} onBack={onBack}');
    expect(screenHeader).toContain('<View style={styles.side}>');
    expect(screenHeader).toContain('<View style={[styles.side, styles.right]}>');
    expect(screenHeader).toContain('width: 76');
    expect(screenHeader).toContain("textAlign: 'center'");
    expect(screenHeader).toContain('flex: 1');
  });

  it('preserves the existing destinations for both top navigation links', () => {
    expect(recipeRoutes).toContain("pathname: '/recipes'");
    expect(householdRoutes).toContain("root: () => '/households'");
    expect(shopping).not.toContain("'/recipes/index'");
    expect(shopping).not.toContain("'/households/index'");
  });

  it('renders the app header from the active user and shopping list data', () => {
    expect(shopping).toContain('<ShoppingAppHeader');
    expect(shopping).toContain('userName={displayName}');
    expect(shopping).toContain('activeListName={household.name}');
    expect(shopping).toContain('title={text.title}');
    expect(shoppingHeader).toContain('{userName}');
    expect(shoppingHeader).toContain('const listLabel = activeListName || noActiveListLabel;');
    expect(shoppingHeader).toContain('{listLabel}');
    expect(shoppingHeader).toContain("ios: 'person.crop.circle'");
    expect(shoppingHeader).toContain('testID="navigation-households"');
    expect(home).toContain('household={activeHousehold}');
  });

  it('keeps branding left and the compact, truncated user and active-list block on the right', () => {
    expect(shoppingHeader).toContain("justifyContent: 'space-between'");
    expect(shoppingHeader).toContain("justifyContent: 'flex-end'");
    expect(shoppingHeader.indexOf('testID="navigation-households"')).toBeLessThan(
      shoppingHeader.indexOf('testID="profile-logout-button"'),
    );
    expect(shoppingHeader.match(/numberOfLines={1}/g)).toHaveLength(3);
    expect(shoppingHeader.match(/ellipsizeMode="tail"/g)).toHaveLength(2);
    expect(shoppingHeader).toContain('fontSize: 25');
    expect(shoppingHeader).toContain("fontWeight: '700'");
  });

  it('does not repeat the shopping list heading after the product form', () => {
    expect(localization).toContain("toBuy: 'Lista'");
    expect(localization).toContain("toBuy: 'List'");
    expect(localization).not.toContain("toBuy: 'Do kupienia'");
    expect(shopping).not.toContain('{text.toBuy}');
    expect(shopping).not.toContain("toLocaleUpperCase('pl-PL')");
    expect(screenHeader).toContain('fontSize: 24');
    expect(screenHeader).toContain('fontSize: 26');
    expect(shoppingHeader).toContain('fontSize: 25');
    expect(localization).toContain("todoTitle: 'Zadania'");
    expect(localization).toContain("todoTab: 'Zadania'");
    expect(localization).toContain("todoTitle: 'Tasks'");
    expect(localization).toContain("todoTab: 'Tasks'");
  });

  it('uses a native logout symbol without visible text and keeps the existing handler', () => {
    expect(shoppingHeader).toContain("flexDirection: 'row'");
    expect(shoppingHeader).toContain('<SymbolView');
    expect(shoppingHeader).toContain("android: 'logout', web: 'logout'");
    expect(shoppingHeader).toContain('accessibilityLabel={signOutLabel}');
    expect(shoppingHeader).toContain('onPress={onSignOut}');
    expect(shoppingHeader).not.toContain('<Text style={styles.signOutText}>');
    expect(home).toContain('onSignOut={() => void handleSignOut()}');
  });

  it('keeps shopping sync status hidden after a successful connection', () => {
    expect(shopping).toContain("realtimeStatus !== 'connected'");
    expect(shopping).toContain(
      "realtimeStatus === 'error' ? text.realtimeError : text.realtimeConnecting",
    );
    expect(shopping).not.toContain('{text.realtimeConnected}');
  });

  it('shows compact unit and category selectors with choices revealed only on demand', () => {
    expect(shopping).toContain('setShowUnitOptions((visible) => !visible)');
    expect(shopping).toContain('{showUnitOptions ? (');
    expect(shopping).toContain('setShowCategoryOptions((visible) => !visible)');
    expect(shopping).toContain('{showCategoryOptions ? (');
    expect(shopping).toContain('style={styles.selectorsRow}');
    expect(shopping).toContain('getShoppingCategory(value).emoji');
    expect(shopping).toContain('categoryManuallyOverridden.current = true');
    expect(shopping).toContain("{showCategoryOptions ? '‹' : '›'}");
    expect(shopping).not.toContain('${text.change} ›');
  });

  it('provides direct product edit and delete actions with compact product rows', () => {
    expect(shopping).toContain('onPress={() => scheduleDelete([item.id], text.undoDeleted(item.name))}');
    expect(shopping).toContain("ios: 'trash', android: 'delete_outline', web: 'delete_outline'");
    expect(shopping).toContain('testID={`shopping-item-edit-${item.id}`}');
    expect(shopping).toContain('accessibilityLabel={text.editItem}');
    expect(shopping).toContain('testID={`shopping-edit-save-${item.id}`}');
    expect(shopping).toContain('minHeight: 50');
    expect(shopping).toContain('height: 48');
  });

  it('renders the purchased section only when it has items and includes its count', () => {
    expect(shopping).toContain('purchasedItems.length > 0 ? (');
    expect(shopping).toContain('{text.purchased} ({purchasedItems.length})');
    expect(shopping).not.toContain('text.emptyPurchased');
    expect(shopping).not.toContain('styles.listFooter');
  });
});
