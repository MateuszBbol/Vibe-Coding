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
        steps: [
          { text: '  Przygotuj warzywa.  ', duration_minutes: '5' },
          { text: '   ', duration_minutes: '30' },
          { text: 'Gotuj.' },
        ],
      }).steps,
    ).toEqual([
      { text: 'Przygotuj warzywa.', duration_minutes: 5, ingredient_keys: [], sort_order: 0 },
      { text: 'Gotuj.', duration_minutes: null, ingredient_keys: [], sort_order: 1 },
    ]);
  });

  it('keeps the optional ingredients chosen for a step', () => {
    expect(
      recipeSchema.parse({
        ...validRecipe,
        steps: [{ text: 'Wymieszaj.', duration_minutes: '', ingredient_keys: ['a', 'b'] }],
      }).steps,
    ).toEqual([
      { text: 'Wymieszaj.', duration_minutes: null, ingredient_keys: ['a', 'b'], sort_order: 0 },
    ]);
  });

  it('accepts a recipe without preparation steps', () => {
    expect(recipeSchema.parse(validRecipe).steps).toEqual([]);
  });

  it('accepts blank and zero step durations and rejects negative, fractional, and invalid values', () => {
    expect(
      recipeSchema.parse({
        ...validRecipe,
        steps: [
          { text: 'Bez czasu', duration_minutes: '' },
          { text: 'Bez czasu podanego', duration_minutes: '0' },
        ],
      }).steps,
    ).toEqual([
      { text: 'Bez czasu', duration_minutes: null, ingredient_keys: [], sort_order: 0 },
      { text: 'Bez czasu podanego', duration_minutes: 0, ingredient_keys: [], sort_order: 1 },
    ]);

    for (const duration of ['-1', '1.5', 'abc', '2147483648']) {
      expect(
        recipeSchema.safeParse({
          ...validRecipe,
          steps: [{ text: 'Krok', duration_minutes: duration }],
        }).success,
      ).toBe(false);
    }
  });
});
