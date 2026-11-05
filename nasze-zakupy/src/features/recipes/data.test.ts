import { addRecipeToActiveList, fetchRecipe, saveRecipe } from './data';

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('recipe data RPCs', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  it.each(['index', 'new', ''])(
    'does not query Supabase for invalid recipe ID "%s"',
    async (id) => {
      await expect(fetchRecipe('household-1', id)).resolves.toBeNull();
      expect(mockFrom).not.toHaveBeenCalled();
    },
  );

  it('saves recipe and ingredients atomically through the household-scoped RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'recipe-1', error: null });
    const values = {
      name: 'Naleśniki',
      description: '',
      items: [
        {
          name: 'Mąka',
          quantity: 250,
          unit: 'g' as const,
          category: 'groceries' as const,
          sort_order: 0,
        },
      ],
      steps: [{ text: 'Przygotuj składniki.', sort_order: 0 }],
    };

    await expect(saveRecipe('household-1', null, values)).resolves.toBe('recipe-1');
    expect(mockRpc).toHaveBeenCalledWith('save_recipe_with_steps', {
      target_household_id: 'household-1',
      target_recipe_id: null,
      target_name: 'Naleśniki',
      target_description: null,
      target_items: values.items,
      target_steps: values.steps,
    });
  });

  it('adds ingredients through the atomic RPC and returns the existing list identity', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ items_added: 5, list_id: 'list-1', list_name: 'Zakupy' }],
      error: null,
    });

    await expect(addRecipeToActiveList('recipe-1')).resolves.toEqual({
      itemsAdded: 5,
      listId: 'list-1',
      listName: 'Zakupy',
    });
    expect(mockRpc).toHaveBeenCalledWith('add_recipe_to_active_shopping_list', {
      target_recipe_id: 'recipe-1',
    });
  });

  it('propagates errors from adding recipe ingredients', async () => {
    const rpcError = new Error('RPC failed');
    mockRpc.mockResolvedValueOnce({ data: null, error: rpcError });

    await expect(addRecipeToActiveList('recipe-1')).rejects.toBe(rpcError);
  });
});
