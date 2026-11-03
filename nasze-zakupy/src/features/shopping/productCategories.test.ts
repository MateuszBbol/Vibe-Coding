import {
  categoryAfterProductNameChange,
  classifyShoppingProduct,
  productCategoryAliasCount,
} from './productCategories';

describe('classifyShoppingProduct', () => {
  it.each([
    ['mleko', 'dairy'],
    ['MLEKO', 'dairy'],
    ['mleko 3,2%', 'dairy'],
    ['mleko bez laktozy', 'dairy'],
    ['banan', 'produce'],
    ['banany', 'produce'],
    ['pomidor', 'produce'],
    ['chleb', 'bakery'],
    ['bułki', 'bakery'],
    ['pierś z kurczaka', 'meat_fish'],
    ['łosoś', 'meat_fish'],
    ['ryż', 'groceries'],
    ['makaron', 'groceries'],
    ['pizza mrożona', 'frozen'],
    ['lody', 'frozen'],
    ['chipsy', 'snacks'],
    ['czekolada', 'snacks'],
    ['cola', 'drinks'],
    ['coca cola', 'drinks'],
    ['cola zero', 'drinks'],
    ['woda gazowana', 'drinks'],
    ['płyn do naczyń', 'hygiene'],
    ['papier toaletowy', 'hygiene'],
    ['worki na śmieci', 'home'],
    ['folia aluminiowa', 'home'],
    ['   MLEKO   ', 'dairy'],
    ['mleko    bez laktozy', 'dairy'],
    ['mleko bez laktozy 2%', 'dairy'],
    ['mleko bez laktozowy', 'dairy'],
    ['produkt nieznany słownikowi', 'other'],
  ] as const)('classifies "%s" as %s', (productName, expectedCategory) => {
    expect(classifyShoppingProduct(productName)).toBe(expectedCategory);
  });

  it('contains a practical dictionary of 300 to 500 aliases', () => {
    expect(productCategoryAliasCount).toBeGreaterThanOrEqual(300);
    expect(productCategoryAliasCount).toBeLessThanOrEqual(500);
  });
});

describe('categoryAfterProductNameChange', () => {
  it('reclassifies an automatically selected category when the name changes', () => {
    expect(categoryAfterProductNameChange('Cola', 'dairy', false)).toBe('drinks');
  });

  it('preserves a manual category override when the product name changes', () => {
    expect(categoryAfterProductNameChange('Cola', 'groceries', true)).toBe('groceries');
  });

  it('classifies a new product name after the form override has been reset', () => {
    expect(categoryAfterProductNameChange('Banany', null, false)).toBe('produce');
  });
});
