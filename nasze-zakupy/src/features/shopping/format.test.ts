import { formatShoppingItemQuantity } from './format';

describe('formatShoppingItemQuantity', () => {
  it('formats quantity and unit together', () => {
    expect(formatShoppingItemQuantity(2, 'szt.')).toBe('2 szt.');
    expect(formatShoppingItemQuantity(250, 'g')).toBe('250 g');
  });

  it('formats decimal quantities using Polish decimal notation', () => {
    expect(formatShoppingItemQuantity(1.5, 'kg')).toBe('1,5 kg');
  });

  it('shows quantity without a unit', () => {
    expect(formatShoppingItemQuantity(5, null)).toBe('5');
  });

  it('shows a unit without a quantity and hides null values', () => {
    expect(formatShoppingItemQuantity(null, 'l')).toBe('l');
    expect(formatShoppingItemQuantity(null, null)).toBe('');
  });
});
