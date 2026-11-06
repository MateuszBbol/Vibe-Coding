import type { ShoppingItem } from './data';
import { getShoppingCategory, groupUnpurchasedItems, shoppingCategories } from './categories';

function createItem(
  id: string,
  category: ShoppingItem['category'],
  isPurchased = false,
): ShoppingItem {
  return {
    id,
    list_id: 'list-1',
    name: id,
    quantity: null,
    unit: null,
    category,
    is_purchased: isPurchased,
    created_at: '2026-10-28T10:00:00.000Z',
    updated_at: '2026-10-28T10:00:00.000Z',
  };
}

describe('shopping categories', () => {
  it('defines all 11 category IDs, labels, emojis, and the required order', () => {
    expect(
      shoppingCategories.map(({ id, label, emoji, order }) => [id, label, emoji, order]),
    ).toEqual([
      ['produce', 'Warzywa i owoce', '🥦', 1],
      ['bakery', 'Pieczywo', '🥖', 2],
      ['dairy', 'Nabiał i jajka', '🥛', 3],
      ['meat_fish', 'Mięso i ryby', '🥩', 4],
      ['groceries', 'Produkty spożywcze', '🍝', 5],
      ['frozen', 'Mrożonki', '❄️', 6],
      ['snacks', 'Przekąski i słodycze', '🍪', 7],
      ['drinks', 'Napoje', '🥤', 8],
      ['hygiene', 'Chemia i higiena', '🧴', 9],
      ['home', 'Dom', '🏠', 10],
      ['other', 'Inne', '📦', 11],
    ]);
  });

  it('treats missing or unknown category IDs as Inne', () => {
    expect(getShoppingCategory(null).id).toBe('other');
    expect(getShoppingCategory(undefined).id).toBe('other');
    expect(getShoppingCategory('unrecognized').id).toBe('other');
  });

  it('groups only unpurchased products in category order and skips empty categories', () => {
    const items = [
      createItem('cola', 'drinks'),
      createItem('milk', 'dairy'),
      createItem('old bread', 'bakery', true),
      createItem('bread', 'bakery'),
      createItem('uncategorized', null),
    ];

    expect(groupUnpurchasedItems(items)).toEqual([
      { category: shoppingCategories[1], items: [items[3]] },
      { category: shoppingCategories[2], items: [items[1]] },
      { category: shoppingCategories[7], items: [items[0]] },
      { category: shoppingCategories[10], items: [items[4]] },
    ]);
  });

  it('returns no category groups when the list has no unpurchased products', () => {
    expect(groupUnpurchasedItems([createItem('bought milk', 'dairy', true)])).toEqual([]);
  });
});
