import { shoppingItemSchema } from './schemas';

describe('shoppingItemSchema', () => {
  it('trims the product name and accepts a product without a unit', () => {
    expect(shoppingItemSchema.parse({ name: '  Chleb ', quantity: '2', unit: null })).toEqual({
      name: 'Chleb',
      quantity: 2,
      unit: null,
      category: null,
    });
  });

  it('accepts integer quantity and a supported unit', () => {
    expect(shoppingItemSchema.parse({ name: 'Mleko', quantity: '2', unit: 'szt.' })).toEqual({
      name: 'Mleko',
      quantity: 2,
      unit: 'szt.',
      category: null,
    });
  });

  it('accepts decimal quantities', () => {
    expect(shoppingItemSchema.parse({ name: 'Banany', quantity: '1.5', unit: 'kg' })).toEqual({
      name: 'Banany',
      quantity: 1.5,
      unit: 'kg',
      category: null,
    });
  });

  it('normalizes a Polish decimal separator before saving', () => {
    expect(shoppingItemSchema.parse({ name: 'Napój', quantity: '1,5', unit: 'l' })).toEqual({
      name: 'Napój',
      quantity: 1.5,
      unit: 'l',
      category: null,
    });
  });

  it('accepts a selected category identifier', () => {
    expect(
      shoppingItemSchema.parse({
        name: 'Mleko',
        quantity: '2',
        unit: 'szt.',
        category: 'dairy',
      }).category,
    ).toBe('dairy');
  });

  it('rejects an empty name, invalid units or categories, and invalid quantities', () => {
    expect(shoppingItemSchema.safeParse({ name: ' ', quantity: '', unit: null }).success).toBe(
      false,
    );
    const emptyQuantity = shoppingItemSchema.safeParse({ name: 'Chleb', quantity: '' });
    expect(emptyQuantity.success).toBe(false);
    if (!emptyQuantity.success) {
      expect(emptyQuantity.error.issues[0]?.message).toBe('Wpisz ilość produktu.');
    }
    expect(shoppingItemSchema.safeParse({ name: 'Chleb', quantity: 'abc' }).success).toBe(false);
    expect(shoppingItemSchema.safeParse({ name: 'Chleb', quantity: '0' }).success).toBe(false);
    expect(shoppingItemSchema.safeParse({ name: 'Chleb', quantity: '-1' }).success).toBe(false);
    expect(
      shoppingItemSchema.safeParse({ name: 'Chleb', quantity: '2', unit: 'litr' }).success,
    ).toBe(false);
    expect(
      shoppingItemSchema.safeParse({ name: 'Chleb', quantity: '2', unit: null, category: 'food' })
        .success,
    ).toBe(false);
  });
});
