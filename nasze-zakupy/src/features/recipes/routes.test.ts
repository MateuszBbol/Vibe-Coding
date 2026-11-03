import { isValidRecipeId, recipeQueryKeys, recipeRoutes } from './routes';

describe('recipe navigation routes', () => {
  const recipeId = '550e8400-e29b-41d4-a716-446655440000';

  it('creates a household-scoped recipes list route', () => {
    expect(recipeRoutes.list('household-1')).toEqual({
      pathname: '/recipes',
      params: { householdId: 'household-1' },
    });
    expect(JSON.stringify(recipeRoutes.list('household-1'))).not.toContain('index');
  });

  it('preserves household and recipe IDs across details, create, and edit routes', () => {
    expect(recipeRoutes.details('household-1', recipeId)).toEqual({
      pathname: '/recipes/[recipeId]',
      params: { householdId: 'household-1', recipeId },
    });
    expect(recipeRoutes.create('household-1')).toEqual({
      pathname: '/recipes/new',
      params: { householdId: 'household-1' },
    });
    expect(recipeRoutes.edit('household-1', recipeId)).toEqual({
      pathname: '/recipes/[recipeId]/edit',
      params: { householdId: 'household-1', recipeId },
    });
  });

  it('accepts only canonical UUID recipe IDs', () => {
    expect(isValidRecipeId(recipeId)).toBe(true);
    expect(isValidRecipeId('index')).toBe(false);
    expect(isValidRecipeId('new')).toBe(false);
    expect(isValidRecipeId('')).toBe(false);
    expect(isValidRecipeId(undefined)).toBe(false);
  });

  it('keeps recipe caches isolated by household', () => {
    expect(recipeQueryKeys.list('household-1')).not.toEqual(recipeQueryKeys.list('household-2'));
    expect(recipeQueryKeys.detail('household-1', 'recipe-1')).not.toEqual(
      recipeQueryKeys.detail('household-2', 'recipe-1'),
    );
  });
});
