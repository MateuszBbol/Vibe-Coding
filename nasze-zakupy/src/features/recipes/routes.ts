import type { Href } from 'expo-router';

const RECIPE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidRecipeId(recipeId: string | undefined): recipeId is string {
  return recipeId !== undefined && RECIPE_ID_PATTERN.test(recipeId);
}

export const recipeRoutes = {
  list: (householdId: string) =>
    ({
      pathname: '/recipes',
      params: { householdId },
    }) as Href,
  details: (householdId: string, recipeId: string) =>
    ({
      pathname: '/recipes/[recipeId]',
      params: { householdId, recipeId },
    }) as Href,
  create: (householdId: string) =>
    ({
      pathname: '/recipes/new',
      params: { householdId },
    }) as Href,
  edit: (householdId: string, recipeId: string) =>
    ({
      pathname: '/recipes/[recipeId]/edit',
      params: { householdId, recipeId },
    }) as Href,
} as const;

export const recipeQueryKeys = {
  list: (householdId: string) => ['recipes', householdId] as const,
  detail: (householdId: string, recipeId: string) => ['recipe', householdId, recipeId] as const,
};
