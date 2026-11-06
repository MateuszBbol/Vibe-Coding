import type { RecipeDetails, RecipeItem, RecipeSaveValues, RecipeStep } from './data';
import type { RecipeFormValues } from './schemas';

// While the recipe form is edited, ingredients can be added, removed and reordered, so a
// step points at ingredients by a client-only key. On save the keys become positions in
// the saved ingredient list (= their sort_order), which is what the database stores.

let keyCounter = 0;

export function newIngredientKey(): string {
  keyCounter += 1;
  return `new-${Date.now().toString(36)}-${keyCounter}`;
}

export function ingredientKeyForSortOrder(sortOrder: number): string {
  return `saved-${sortOrder}`;
}

export function buildRecipeSaveValues(values: RecipeFormValues): RecipeSaveValues {
  const indexByKey = new Map<string, number>();
  values.items.forEach((item, index) => {
    if (item.key) {
      indexByKey.set(item.key, index);
    }
  });
  return {
    name: values.name,
    description: values.description,
    items: values.items.map(({ key: _key, ...item }, index) => ({ ...item, sort_order: index })),
    steps: values.steps.map(({ ingredient_keys, ...step }) => ({
      ...step,
      // Removed ingredients are dropped; duplicates collapse; order follows the list.
      ingredient_indexes: [
        ...new Set(
          ingredient_keys
            .map((key) => indexByKey.get(key))
            .filter((index): index is number => index !== undefined),
        ),
      ].sort((left, right) => left - right),
    })),
  };
}

// Ingredients of a saved step, in the order of the recipe's ingredient list.
export function stepIngredients(
  step: Pick<RecipeStep, 'ingredient_sort_orders'>,
  items: RecipeDetails['items'],
): RecipeItem[] {
  const wanted = new Set(step.ingredient_sort_orders);
  return items.filter((item) => wanted.has(item.sort_order));
}
