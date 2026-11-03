import { addShoppingItem, deletePurchasedShoppingItems } from './data';

const mockFrom = jest.fn();
const mockQuery = {
  delete: jest.fn(),
  eq: jest.fn(),
  insert: jest.fn(),
  is: jest.fn(),
  then: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('deletePurchasedShoppingItems', () => {
  beforeEach(() => {
    mockFrom.mockReset().mockReturnValue(mockQuery);
    mockQuery.delete.mockReset().mockReturnValue(mockQuery);
    mockQuery.eq.mockReset().mockReturnValue(mockQuery);
    mockQuery.insert.mockReset().mockReturnValue(mockQuery);
    mockQuery.is.mockReset().mockReturnValue(mockQuery);
    mockQuery.then.mockImplementation(
      (
        resolve: (value: { error: null }) => unknown,
        reject: ((reason: unknown) => unknown) | undefined,
      ) => Promise.resolve({ error: null }).then(resolve, reject),
    );
  });

  it('deletes only purchased, active products from the requested list', async () => {
    await deletePurchasedShoppingItems('active-list-id');

    expect(mockFrom).toHaveBeenCalledWith('shopping_items');
    expect(mockQuery.delete).toHaveBeenCalledTimes(1);
    expect(mockQuery.eq).toHaveBeenNthCalledWith(1, 'list_id', 'active-list-id');
    expect(mockQuery.eq).toHaveBeenNthCalledWith(2, 'is_purchased', true);
    expect(mockQuery.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('inserts a product with null quantity and unit when both are omitted', async () => {
    await addShoppingItem('active-list-id', 'user-id', 'Chleb', null, null, null);

    expect(mockFrom).toHaveBeenCalledWith('shopping_items');
    expect(mockQuery.insert).toHaveBeenCalledWith({
      list_id: 'active-list-id',
      name: 'Chleb',
      quantity: null,
      unit: null,
      category: null,
      created_by: 'user-id',
    });
  });

  it('preserves decimal quantities and selected units for Supabase', async () => {
    await addShoppingItem('active-list-id', 'user-id', 'Banany', 1.5, 'kg', null);

    expect(mockQuery.insert).toHaveBeenCalledWith({
      list_id: 'active-list-id',
      name: 'Banany',
      quantity: 1.5,
      unit: 'kg',
      category: null,
      created_by: 'user-id',
    });
  });

  it('inserts a selected category with the product data', async () => {
    await addShoppingItem('active-list-id', 'user-id', 'Mleko', 2, 'szt.', 'dairy');

    expect(mockQuery.insert).toHaveBeenCalledWith({
      list_id: 'active-list-id',
      name: 'Mleko',
      quantity: 2,
      unit: 'szt.',
      category: 'dairy',
      created_by: 'user-id',
    });
  });
});
