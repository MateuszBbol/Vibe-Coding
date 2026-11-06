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
const bottomNav = readFileSync(resolve(root, 'components/AppBottomNav.tsx'), 'utf8');
const householdRoutes = readFileSync(resolve(root, 'features/households/routes.ts'), 'utf8');
const todo = readFileSync(resolve(root, 'features/todo/TodoSection.tsx'), 'utf8');

describe('screen layout contract', () => {
  it('keeps one create action and a text-only empty state for recipes', () => {
    expect(recipeList.match(/RecipeButton label={text\.create}/g)).toHaveLength(1);
    expect(recipeList).not.toContain('text.firstRecipe');
    expect(localization).not.toContain('firstRecipe:');
    expect(localization).toContain("create: 'Nowy przepis'");
    expect(localization).toContain("create: 'New recipe'");
  });

  it('uses a single bottom navigation with four sections in a fixed order', () => {
    expect(shopping).not.toContain('styles.navigationButtons');
    expect(shopping).not.toContain('styles.tabsRow');
    expect(shopping).not.toContain('<ScreenHeader');
    const order = [
      "testID: 'home-tab-shopping'",
      "testID: 'home-tab-todo'",
      "testID: 'navigation-recipes'",
      "testID: 'navigation-households'",
    ].map((id) => bottomNav.indexOf(id));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(bottomNav).toContain('accessibilityRole="tab"');
    expect(bottomNav).toContain('accessibilityState={{ selected }}');
    expect(bottomNav).toContain('minHeight: 56');
    expect(bottomNav).toContain('<SymbolView name={item.icon}');
    expect(shopping).toContain('{bottomNav}');
  });

  it('keeps the bottom navigation out of the scroll area and above the safe-area inset', () => {
    expect(bottomNav).toContain('useSafeAreaInsets()');
    expect(bottomNav).toContain('paddingBottom: Math.max(insets.bottom, Spacing.one)');
    expect(shopping).toContain("edges={['top', 'left', 'right']}");
    expect(shopping.lastIndexOf('</ScrollView>')).toBeLessThan(shopping.lastIndexOf('{bottomNav}'));
    expect(householdUI).toContain('{section ? <AppBottomNav active={section} /> : null}');
    expect(recipeUI).toContain('{section ? <AppBottomNav active={section} /> : null}');
  });

  it('keeps the section in the URL and switches home sections in place', () => {
    expect(bottomNav).toContain("todo: { pathname: '/home', params: { section: 'todo' } }");
    expect(shopping).toContain("sectionParam === 'todo' ? 'todo' : 'shopping'");
    expect(shopping).toContain(
      "router.setParams({ section: section === 'todo' ? 'todo' : undefined })",
    );
  });

  it('keeps list management, sharing and deletion off the shopping screen', () => {
    expect(shopping).not.toContain('shopping-list-menu-button');
    expect(shopping).not.toContain('invitations(');
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
    expect(shoppingHeader).toContain('testID="profile-identity"');
    expect(shoppingHeader).not.toContain('navigation-households');
    expect(home).toContain('household={activeHousehold}');
  });

  it('centres the title with the user and list block top-left and logout top-right', () => {
    // Equal side columns around the title keep it centred on the screen.
    expect(shoppingHeader).toContain('<View style={[styles.side, styles.left]}>');
    expect(shoppingHeader).toContain('<View style={[styles.side, styles.right]}>');
    expect(shoppingHeader).toContain('flexBasis: 0');
    expect(shoppingHeader).toContain("textAlign: 'center'");
    const identity = shoppingHeader.indexOf('testID="profile-identity"');
    const title = shoppingHeader.indexOf('{title}');
    const logout = shoppingHeader.indexOf('testID="profile-logout-button"');
    expect(identity).toBeGreaterThan(-1);
    expect(identity).toBeLessThan(title);
    expect(title).toBeLessThan(logout);
    expect(shoppingHeader).toContain("justifyContent: 'flex-start'");
    expect(shoppingHeader).toContain("justifyContent: 'flex-end'");
    expect(shoppingHeader.match(/numberOfLines={1}/g)).toHaveLength(3);
    expect(shoppingHeader.match(/ellipsizeMode="tail"/g)).toHaveLength(2);
    expect(shoppingHeader).toContain('fontSize: 25');
    expect(shoppingHeader).toContain("fontWeight: '700'");
  });

  it('labels the items to buy as "Lista zakupów" once, above the product groups', () => {
    expect(localization).toContain("toBuy: 'Lista zakupów'");
    expect(localization).toContain("toBuy: 'Shopping list'");
    expect(localization).not.toContain("toBuy: 'Do kupienia'");
    expect(shopping.match(/\{text\.toBuy\}/g)).toHaveLength(1);
    expect(shopping.indexOf('testID="shopping-to-buy-title"')).toBeLessThan(
      shopping.indexOf('itemsToBuy.length > 0 ? ('),
    );
    expect(shopping).not.toContain("toLocaleUpperCase('pl-PL')");
    expect(screenHeader).toContain('fontSize: 24');
    expect(screenHeader).toContain('fontSize: 26');
    expect(shoppingHeader).toContain('fontSize: 25');
    expect(localization).not.toContain('todoTitle:');
    expect(localization).toContain("todoTab: 'Zadania'");
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
    expect(shopping).toContain(
      'onPress={() => scheduleDelete([item.id], text.undoDeleted(item.name))}',
    );
    expect(shopping).toContain("ios: 'trash', android: 'delete_outline', web: 'delete_outline'");
    expect(shopping).toContain('testID={`shopping-item-edit-${item.id}`}');
    expect(shopping).toContain('accessibilityLabel={text.editItem}');
    expect(shopping).toContain('testID={`shopping-edit-save-${item.id}`}');
    expect(shopping).toContain('minHeight: 50');
    expect(shopping).toContain('height: 48');
  });

  it('renders the purchased section only when it has items, without a counter', () => {
    expect(shopping).toContain('purchasedItems.length > 0 ? (');
    expect(shopping).toContain('{text.purchased}');
    expect(shopping).not.toContain('({purchasedItems.length})');
    expect(shopping).not.toContain('text.emptyPurchased');
    expect(shopping).not.toContain('styles.listFooter');
  });

  it('edits only items still to buy and strikes through quantity of purchased items', () => {
    expect(shopping).toContain('{item.is_purchased && !isEditing ? (');
    expect(shopping.indexOf('{item.is_purchased && !isEditing ? (')).toBeLessThan(
      shopping.indexOf('testID={`shopping-item-edit-${item.id}`}'),
    );
    const quantity = shopping.slice(
      shopping.indexOf('testID={`shopping-item-quantity-${item.id}`}'),
    );
    expect(quantity.slice(0, 300)).toContain(
      "textDecorationLine: item.is_purchased ? 'line-through' : 'none'",
    );
  });
});

describe('shopping item edit form contract', () => {
  it('hides the checkbox and row actions while editing and uses check / X icons', () => {
    const guard = shopping.indexOf('{isEditing ? null : (');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(shopping.indexOf('testID={`shopping-item-checkbox-${item.id}`}'));
    expect(shopping).toMatch(/\{isEditing \? null : \(\s*<View style=\{styles\.itemActions\}>/);
    expect(shopping).toContain("name={{ ios: 'checkmark', android: 'check', web: 'check' }}");
    expect(shopping).toContain("name={{ ios: 'xmark', android: 'close', web: 'close' }}");
    expect(shopping).toContain('testID={`shopping-edit-save-${item.id}`}');
    expect(shopping).toContain('testID={`shopping-edit-cancel-${item.id}`}');
  });

  it('gives the quantity field room instead of a fixed narrow width', () => {
    const style = shopping.slice(shopping.indexOf('  editQuantityInput: {'));
    expect(style.slice(0, 120)).toContain('flex: 1');
    expect(style.slice(0, 120)).toContain('minWidth: 72');
  });

  it('uses one heading style for "Lista zakupów" and "Kupione"', () => {
    expect(shopping).toContain('<View style={styles.sectionHeader}>');
    expect(shopping).toContain('<View style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>');
    expect(
      shopping.match(/style=\{\[styles\.sectionTitle, \{ color: colors\.text \}\]\}/g),
    ).toHaveLength(2);
  });
});

describe('tasks layout contract', () => {
  it('splits open tasks into today (overdue included) and later', () => {
    expect(todo).toContain("type DueGroup = 'today' | 'later';");
    expect(todo).toContain("return dueDate && dueDate <= today ? 'today' : 'later';");
    expect(todo).toContain("(['today', 'later'] as const)");
    expect(localization).toContain("todoToday: 'Dzisiaj'");
    expect(localization).toContain("todoLater: 'Później'");
  });

  it('shows Dzisiaj, Później and Zrobione as three identical sections with centred headings', () => {
    expect(todo).not.toContain('todoUpcoming');
    expect(todo.match(/styles\.panel,/g)).toHaveLength(2);
    expect(todo).toContain('testID={`todo-group-${group.key}`}');
    expect(todo).toContain('testID="todo-group-completed"');
    expect(todo).toContain(
      "panelHeading: { fontSize: 16, fontWeight: '700', textAlign: 'center' }",
    );
    expect(todo).toContain("position: 'absolute'");
    expect(todo).not.toContain('({pendingItems.length})');
    expect(todo).not.toContain('({completedItems.length})');
    expect(todo).not.toContain('({group.items.length})');
  });

  it('assigns with inline person icons, the current user first, and "Wszyscy"', () => {
    expect(todo).toContain('{text.todoMembers}:');
    expect(todo).toContain('...members.filter((member) => member.user_id === currentUserId),');
    expect(todo).toContain('testID={`${testID}-all`}');
    expect(todo).toContain('onPress={() => onChange([])}');
    expect(todo).not.toContain('-toggle`}');
    expect(localization).toContain("todoNoAssignees: 'Wszyscy'");
  });

  it('keeps the optional deadline behind a compact button', () => {
    const picker = readFileSync(resolve(root, 'features/todo/TodoDatePicker.tsx'), 'utf8');
    expect(picker).toContain('`+ ${text.todoDueDatePlaceholder}`');
    expect(picker).toContain('{isOpen ? (');
    expect(localization).toContain("todoDueDatePlaceholder: 'Termin'");
  });

  it('offers editing only for tasks that are not completed', () => {
    const guard = todo.indexOf('{item.completed ? null : (');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(todo.indexOf('testID={`todo-edit-${item.id}`}'));
  });
});
