const { readFileSync } = require('fs');
const { resolve } = require('path');

// Contract for Playwright: stable, predictable locators and web-visible state.
const read = (file) => readFileSync(resolve(__dirname, '../../src', file), 'utf8');

const recipeForm = read('features/recipes/RecipeFormScreen.tsx');
const shopping = read('features/shopping/ShoppingHome.tsx');
const todo = read('features/todo/TodoSection.tsx');
const datePicker = read('features/todo/TodoDatePicker.tsx');
const cook = read('features/recipes/RecipeCookScreen.tsx');
const setup = read('features/households/HouseholdSetup.tsx');

describe('Playwright locators', () => {
  test('recipe form ingredients and step ingredients use position-based test ids', () => {
    expect(recipeForm).toContain('testID={`recipe-ingredient-${index}`}');
    expect(recipeForm).not.toContain('testID={`recipe-ingredient-${field.id}`}');
    expect(recipeForm).toContain('testID={`recipe-step-${index}-ingredient-${itemIndex}`}');
    expect(recipeForm).not.toMatch(/ingredient-\$\{item\.name/);
  });

  test('row actions name the item they act on', () => {
    expect(shopping).toContain('accessibilityLabel={`${text.editItem}: ${item.name}`}');
    expect(shopping).toContain('accessibilityLabel={`${text.deleteItem}: ${item.name}`}');
    expect(todo).toContain('accessibilityLabel={`${text.todoEdit}: ${item.title}`}');
    expect(todo).toContain('accessibilityLabel={`${text.todoDelete}: ${item.title}`}');
    expect(recipeForm).toContain('accessibilityLabel={`${text.removeIngredient} ${index + 1}`}');
    expect(recipeForm).toMatch(/accessibilityLabel=\{`\$\{text\.removeStep\}: /);
  });

  test('dropdowns expose aria-expanded and single choices expose aria-checked on web', () => {
    for (const flag of [
      'showUnitOptions',
      'showCategoryOptions',
      'editUnitOptionsOpen',
      'editCategoryOptionsOpen',
    ]) {
      expect(shopping).toContain(`aria-expanded={${flag}}`);
    }
    expect(shopping).not.toMatch(/accessibilityState=\{\{ selected/);
    expect(shopping).toContain('aria-checked={editCategory === category.id}');
    expect(todo).toContain('aria-expanded={completedExpanded}');
    expect(datePicker).toContain('aria-expanded={isOpen}');
    expect(cook).toContain('aria-expanded={ingredientsOpen}');
    expect(recipeForm).toContain('aria-expanded={categoryOptionsVisible}');
    expect(recipeForm).toContain('aria-checked={option.id === value}');
  });

  test('each home section has its own screen id and group forms keep a single heading', () => {
    expect(shopping).toContain("activeTab === 'todo' ? 'todo-screen' : 'shopping-screen'");
    expect(setup).toContain(
      "const sectionTitleRole = showCreate && showJoin ? 'header' : undefined;",
    );
  });
});
