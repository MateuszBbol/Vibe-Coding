import { recipeSchema } from './schemas';

describe('recipe schema', () => {
  const validRecipe = {
    name: 'Naleśniki',
    description: '',
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
});
