import {
  buildRecipeSaveValues,
  ingredientKeyForSortOrder,
  newIngredientKey,
  stepIngredients,
} from './stepIngredients';
import type { RecipeItem } from './data';

const item = (name: string, key?: string) => ({
  key,
  name,
  quantity: 1,
  unit: null,
  category: 'other' as const,
});

describe('step ingredients', () => {
  it('creates unique keys for new ingredients', () => {
    expect(newIngredientKey()).not.toBe(newIngredientKey());
    expect(ingredientKeyForSortOrder(2)).toBe('saved-2');
  });

  it('turns step ingredient keys into positions of the saved ingredient list', () => {
    const values = buildRecipeSaveValues({
      name: 'Naleśniki',
      description: '',
      items: [item('Mąka', 'a'), item('Mleko', 'b'), item('Jajka', 'c')],
      steps: [
        {
          text: 'Wymieszaj',
          duration_minutes: null,
          sort_order: 0,
          ingredient_keys: ['c', 'a', 'a'],
        },
        { text: 'Smaż', duration_minutes: 2, sort_order: 1, ingredient_keys: [] },
      ],
    });

    expect(values.items).toEqual([
      { name: 'Mąka', quantity: 1, unit: null, category: 'other', sort_order: 0 },
      { name: 'Mleko', quantity: 1, unit: null, category: 'other', sort_order: 1 },
      { name: 'Jajka', quantity: 1, unit: null, category: 'other', sort_order: 2 },
    ]);
    expect(values.steps).toEqual([
      { text: 'Wymieszaj', duration_minutes: null, sort_order: 0, ingredient_indexes: [0, 2] },
      { text: 'Smaż', duration_minutes: 2, sort_order: 1, ingredient_indexes: [] },
    ]);
  });

  it('drops ingredients that were removed and follows reordering', () => {
    const values = buildRecipeSaveValues({
      name: 'X',
      description: '',
      items: [item('Jajka', 'c'), item('Mąka', 'a')],
      steps: [
        { text: 'Krok', duration_minutes: null, sort_order: 0, ingredient_keys: ['a', 'gone'] },
      ],
    });
    expect(values.steps[0]?.ingredient_indexes).toEqual([1]);
  });

  it('lists a saved step’s ingredients in recipe order', () => {
    const items = [
      {
        id: '1',
        recipe_id: 'r',
        name: 'Mąka',
        quantity: 1,
        unit: 'kg',
        category: 'other',
        sort_order: 0,
      },
      {
        id: '2',
        recipe_id: 'r',
        name: 'Mleko',
        quantity: 500,
        unit: 'ml',
        category: 'dairy',
        sort_order: 1,
      },
      {
        id: '3',
        recipe_id: 'r',
        name: 'Jajka',
        quantity: 2,
        unit: 'szt.',
        category: 'dairy',
        sort_order: 2,
      },
    ] as RecipeItem[];
    expect(
      stepIngredients({ ingredient_sort_orders: [2, 0] }, items).map(({ name }) => name),
    ).toEqual(['Mąka', 'Jajka']);
    expect(stepIngredients({ ingredient_sort_orders: [] }, items)).toEqual([]);
  });
});
