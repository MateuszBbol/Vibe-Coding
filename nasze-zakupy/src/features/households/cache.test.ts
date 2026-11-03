import { QueryClient } from '@tanstack/react-query';

import { removeHouseholdCache } from './cache';

describe('household cache cleanup', () => {
  it('removes only the selected household list and its item cache', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['active-shopping-list', 'user-1', 'household-1'], {
      id: 'list-1',
      name: 'List 1',
    });
    queryClient.setQueryData(['shopping-items', 'list-1'], [{ id: 'item-1' }]);
    queryClient.setQueryData(['active-shopping-list', 'user-1', 'household-2'], {
      id: 'list-2',
      name: 'List 2',
    });
    queryClient.setQueryData(['shopping-items', 'list-2'], [{ id: 'item-2' }]);
    queryClient.setQueryData(['recipes', 'household-1'], [{ id: 'recipe-1' }]);
    queryClient.setQueryData(['recipe', 'household-1', 'recipe-1'], { id: 'recipe-1' });
    queryClient.setQueryData(['recipe-household', 'user-1', 'household-1'], {
      id: 'household-1',
    });
    queryClient.setQueryData(['recipes', 'household-2'], [{ id: 'recipe-2' }]);
    queryClient.setQueryData(['active-shopping-list', 'user-2', 'household-1'], {
      id: 'other-user-list',
      name: 'Other user list',
    });

    await removeHouseholdCache(queryClient, 'user-1', 'household-1');

    expect(
      queryClient.getQueryData(['active-shopping-list', 'user-1', 'household-1']),
    ).toBeUndefined();
    expect(queryClient.getQueryData(['shopping-items', 'list-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['recipes', 'household-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['recipe', 'household-1', 'recipe-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['recipe-household', 'user-1', 'household-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['recipes', 'household-2'])).toEqual([{ id: 'recipe-2' }]);
    expect(queryClient.getQueryData(['active-shopping-list', 'user-1', 'household-2'])).toEqual({
      id: 'list-2',
      name: 'List 2',
    });
    expect(queryClient.getQueryData(['shopping-items', 'list-2'])).toEqual([{ id: 'item-2' }]);
    expect(queryClient.getQueryData(['active-shopping-list', 'user-2', 'household-1'])).toEqual({
      id: 'other-user-list',
      name: 'Other user list',
    });
    queryClient.clear();
  });
});
