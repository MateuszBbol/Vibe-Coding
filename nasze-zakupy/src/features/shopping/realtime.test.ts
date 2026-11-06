import type { ShoppingItem } from './data';
import {
  createShoppingItemDeleteFilters,
  getDeletedShoppingItemId,
  removeDeletedShoppingItem,
} from './realtime';

const firstItem: ShoppingItem = {
  id: 'item-1',
  list_id: 'list-1',
  name: 'Mleko',
  quantity: 1,
  unit: 'szt.',
  category: null,
  is_purchased: false,
  created_at: '2026-10-28T10:00:00.000Z',
  updated_at: '2026-10-28T10:00:00.000Z',
};

const secondItem: ShoppingItem = {
  ...firstItem,
  id: 'item-2',
  name: 'Chleb',
};

describe('shopping item Realtime DELETE handling', () => {
  it('removes the deleted product using only payload.old.id and keeps other cached products', () => {
    const cache = [firstItem, secondItem];
    const payload = {
      eventType: 'DELETE',
      old: { id: 'item-1' },
    };

    const deletedId = getDeletedShoppingItemId(payload);

    expect(deletedId).toBe('item-1');
    expect(removeDeletedShoppingItem(cache, deletedId ?? '')).toEqual([secondItem]);
  });

  it('ignores a DELETE payload without a string primary key', () => {
    expect(getDeletedShoppingItemId({ eventType: 'DELETE', old: {} })).toBeNull();
    expect(getDeletedShoppingItemId({ eventType: 'UPDATE', old: { id: 'item-1' } })).toBeNull();
  });

  it('creates scoped primary-key filters in groups of at most 100 IDs', () => {
    const itemIds = Array.from({ length: 101 }, (_, index) => `item-${index}`);

    expect(createShoppingItemDeleteFilters(itemIds)).toEqual([
      `id=in.(${itemIds.slice(0, 100).join(',')})`,
      'id=in.(item-100)',
    ]);
  });
});
