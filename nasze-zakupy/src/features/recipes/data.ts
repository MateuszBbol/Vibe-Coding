import type { ShoppingCategoryId } from '@/features/shopping/categories';
import type { ShoppingUnit } from '@/features/shopping/schemas';
import { supabase } from '@/lib/supabase/client';
import { isValidRecipeId } from '@/features/recipes/routes';

export type RecipeItem = {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: ShoppingUnit | null;
  category: ShoppingCategoryId;
  sort_order: number;
};

export type Recipe = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  created_at: string;
  items_count: number;
};

export type RecipeStep = {
  id: string;
  recipe_id: string;
  text: string;
  sort_order: number;
  duration_minutes: number | null;
  // sort_order values of the recipe ingredients used in this step (optional).
  ingredient_sort_orders: number[];
};
export type RecipeDetails = Omit<Recipe, 'items_count'> & {
  items: RecipeItem[];
  steps: RecipeStep[];
};
export type RecipeSaveValues = {
  name: string;
  description: string;
  steps: {
    text: string;
    sort_order: number;
    duration_minutes: number | null;
    ingredient_indexes: number[];
  }[];
  items: Omit<RecipeItem, 'id' | 'recipe_id'>[];
};

function requireSupabase() {
  if (!supabase) {
    throw new Error('Brak konfiguracji Supabase.');
  }
  return supabase;
}

export async function fetchRecipes(householdId: string): Promise<Recipe[]> {
  const client = requireSupabase();
  const { data: recipes, error } = await client
    .from('recipes')
    .select('id, household_id, name, description, created_at')
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }
  if (!recipes?.length) {
    return [];
  }

  const { data: recipeItems, error: itemsError } = await client
    .from('recipe_items')
    .select('recipe_id')
    .in(
      'recipe_id',
      recipes.map(({ id }) => id),
    );
  if (itemsError) {
    throw itemsError;
  }

  const counts = new Map<string, number>();
  for (const item of recipeItems ?? []) {
    counts.set(item.recipe_id, (counts.get(item.recipe_id) ?? 0) + 1);
  }
  return recipes.map((recipe) => ({ ...recipe, items_count: counts.get(recipe.id) ?? 0 }));
}

export async function fetchRecipe(
  householdId: string,
  recipeId: string,
): Promise<RecipeDetails | null> {
  if (!isValidRecipeId(recipeId)) {
    return null;
  }

  const client = requireSupabase();
  const { data: recipe, error } = await client
    .from('recipes')
    .select('id, household_id, name, description, created_at')
    .eq('household_id', householdId)
    .eq('id', recipeId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!recipe) {
    return null;
  }

  const { data: items, error: itemsError } = await client
    .from('recipe_items')
    .select('id, recipe_id, name, quantity, unit, category, sort_order')
    .eq('recipe_id', recipeId)
    .order('sort_order', { ascending: true });
  if (itemsError) {
    throw itemsError;
  }

  const { data: steps, error: stepsError } = await client
    .from('recipe_steps')
    .select('id, recipe_id, text, sort_order, duration_minutes, ingredient_sort_orders')
    .eq('recipe_id', recipeId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });
  if (stepsError) {
    throw stepsError;
  }
  return {
    ...recipe,
    items: items ?? [],
    steps: (steps ?? []).map((step) => ({
      ...step,
      ingredient_sort_orders: step.ingredient_sort_orders ?? [],
    })),
  };
}

export async function saveRecipe(
  householdId: string,
  recipeId: string | null,
  values: RecipeSaveValues,
): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('save_recipe_with_steps', {
    target_household_id: householdId,
    target_recipe_id: recipeId,
    target_name: values.name,
    target_description: values.description || null,
    target_items: values.items,
    target_steps: values.steps,
  });
  if (error) {
    throw error;
  }
  if (typeof data !== 'string') {
    throw new Error('Nie udało się zapisać przepisu.');
  }
  return data;
}

export async function deleteRecipe(householdId: string, recipeId: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('recipes')
    .delete()
    .eq('household_id', householdId)
    .eq('id', recipeId)
    .select('id')
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error('Nie znaleziono przepisu.');
  }
}

export async function addRecipeToActiveList(recipeId: string): Promise<{
  itemsAdded: number;
  listId: string;
  listName: string;
}> {
  const client = requireSupabase();
  const { data, error } = await client.rpc('add_recipe_to_active_shopping_list', {
    target_recipe_id: recipeId,
  });
  if (error) {
    throw error;
  }
  const result = Array.isArray(data) ? data[0] : null;
  if (
    !result ||
    typeof result.items_added !== 'number' ||
    typeof result.list_id !== 'string' ||
    typeof result.list_name !== 'string'
  ) {
    throw new Error('Nie udało się dodać składników do listy.');
  }
  return {
    itemsAdded: result.items_added,
    listId: result.list_id,
    listName: result.list_name,
  };
}
