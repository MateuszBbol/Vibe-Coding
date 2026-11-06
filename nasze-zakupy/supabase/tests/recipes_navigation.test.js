const { readFileSync } = require('fs');
const { resolve } = require('path');

const appRoot = resolve(__dirname, '../../src/app/(app)');
const shopping = readFileSync(
  resolve(appRoot, '../../features/shopping/ShoppingHome.tsx'),
  'utf8',
).toLowerCase();
const recipeList = readFileSync(resolve(appRoot, 'recipes/index.tsx'), 'utf8').toLowerCase();
const recipeDetails = readFileSync(
  resolve(appRoot, 'recipes/[recipeId].tsx'),
  'utf8',
).toLowerCase();
const recipeForm = readFileSync(
  resolve(appRoot, '../../features/recipes/RecipeFormScreen.tsx'),
  'utf8',
).toLowerCase();
const newRecipeRoute = readFileSync(resolve(appRoot, 'recipes/new.tsx'), 'utf8').toLowerCase();
const editRecipeRoute = readFileSync(
  resolve(appRoot, 'recipes/[recipeId]/edit.tsx'),
  'utf8',
).toLowerCase();
const rootLayout = readFileSync(resolve(appRoot, '../_layout.tsx'), 'utf8').toLowerCase();
const authRouting = readFileSync(
  resolve(appRoot, '../../features/auth/routing.ts'),
  'utf8',
).toLowerCase();
const bottomNav = readFileSync(
  resolve(appRoot, '../../components/AppBottomNav.tsx'),
  'utf8',
).toLowerCase();
const recipeRoutes = readFileSync(
  resolve(appRoot, '../../features/recipes/routes.ts'),
  'utf8',
).toLowerCase();

describe('recipe navigation contract', () => {
  it('keeps the recipes entry visible on the shopping screen', () => {
    expect(shopping).toContain('<appbottomnav');
    expect(bottomNav).toContain("label: strings.pl.navigation.recipes");
    expect(bottomNav).toContain("testid: 'navigation-recipes'");
  });

  it('opens the separate recipes route through Expo Router', () => {
    expect(bottomNav).toContain("recipes: '/recipes'");
    expect(bottomNav).toContain('router.replace(item.href)');
    expect(recipeRoutes).toContain("pathname: '/recipes'");
    expect(recipeRoutes).not.toContain("pathname: '/recipes/index'");
    expect(shopping).not.toContain('router.push(reciperoutes.details');
  });

  it('keeps recipe routes behind the signed-in application guard', () => {
    expect(rootLayout).toContain('getauthrouteguards(isconfigured, authstatus)');
    expect(rootLayout).toContain('<stack.protected guard={guards.app}>');
  });

  it('keeps both route groups available until auth bootstrap completes', () => {
    expect(authRouting).toMatch(
      /if\s*\(authstatus === 'loading'\)\s*\{\s*return\s*\{\s*auth:\s*true,\s*app:\s*true\s*\}/,
    );
  });

  it('shows the recipes list as a top-level section with the bottom navigation', () => {
    expect(recipeList).toContain('section="recipes"');
    expect(recipeList).not.toContain('onback={() => router.back()}');
  });

  it('opens recipe details from the household recipe list', () => {
    expect(recipeList).toContain('router.push(reciperoutes.details(household.id, recipe.id))');
  });

  it('returns from recipe details to the household recipe list', () => {
    expect(recipeDetails).toContain('router.dismissto(');
    expect(recipeDetails).toContain('reciperoutes.list(targethouseholdid)');
    expect(recipeDetails).toContain(" : '/recipes'");
    expect(recipeDetails).toContain('onback={returntorecipes}');
  });

  it('opens a separate create form from the recipes list', () => {
    expect(recipeList).toContain('router.push(reciperoutes.create(householdid))');
    expect(recipeRoutes).toContain("pathname: '/recipes/new'");
    expect(newRecipeRoute).toContain('recipeformscreen');
  });

  it('cancels create without saving and returns to the previous route', () => {
    expect(recipeForm).toContain('onback={() => router.back()}');
    expect(recipeForm).toContain('router.replace(reciperoutes.details');
  });

  it('opens the shared form in edit mode from recipe details', () => {
    expect(recipeDetails).toContain('router.push(reciperoutes.edit(household.id, recipe.id))');
    expect(recipeRoutes).toContain("pathname: '/recipes/[recipeid]/edit'");
    expect(editRecipeRoute).toContain('recipeformscreen');
    expect(editRecipeRoute).toContain('isvalidrecipeid(recipeid)');
  });

  it('returns from a successful edit to the current recipe details', () => {
    expect(recipeForm).toContain('if (activerecipeid) {');
    expect(recipeForm).toContain('router.back()');
  });

  it('adds ingredients without navigating away and refreshes the existing shopping cache', () => {
    expect(recipeDetails).toContain('addrecipetoactivelist(recipeid');
    expect(recipeDetails).toContain("['shopping-items', result.listid]");
    expect(recipeDetails).not.toContain('router.replace');
  });
});
