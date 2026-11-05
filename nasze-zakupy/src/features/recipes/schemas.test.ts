import { recipeSchema } from './schemas';

describe('recipe schema', () => {
  const validRecipe = {
    name: 'Naleśniki',
    description: '',
    steps: [],
    items: [{ name: 'Mąka', quantity: '250', unit: 'g', category: 'groceries' }],
  };

  it('parses quantity and keeps optional quantity and unit empty', () => {
    expect(recipeSchema.parse(validRecipe).items[0]).toMatchObject({
      quantity: 250,
      unit: 'g',
    });
    expect(
      recipeSchema.parse({
        ...validRecipe,
        items: [{ ...validRecipe.items[0], quantity: '', unit: null }],
      }).items[0],
    ).toMatchObject({ quantity: null, unit: null });
  });

  it('requires a recipe name and at least one named ingredient', () => {
    expect(recipeSchema.safeParse({ ...validRecipe, name: ' ' }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...validRecipe, items: [] }).success).toBe(false);
    expect(
      recipeSchema.safeParse({
        ...validRecipe,
        items: [{ ...validRecipe.items[0], name: ' ' }],
      }).success,
    ).toBe(false);
  });

  it('trims preparation steps, removes empty steps, and preserves their order', () => {
    expect(
      recipeSchema.parse({
        ...validRecipe,
        steps: [{ text: '  Przygotuj warzywa.  ' }, { text: '   ' }, { text: 'Gotuj.' }],
      }).steps,
    ).toEqual([
      { text: 'Przygotuj warzywa.', sort_order: 0 },
      { text: 'Gotuj.', sort_order: 1 },
    ]);
  });

  it('accepts a recipe without preparation steps', () => {
    expect(recipeSchema.parse(validRecipe).steps).toEqual([]);
  });
});
