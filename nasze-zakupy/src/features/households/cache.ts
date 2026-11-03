import type { QueryClient, QueryKey } from '@tanstack/react-query';

import type { ShoppingList } from '@/features/shopping/data';

export async function removeHouseholdCache(
  queryClient: QueryClient,
  userId: string,
  householdId: string,
): Promise<void> {
  const listQueryKey = ['active-shopping-list', userId, householdId] as const;
  const recipeListQueryKey = ['recipes', householdId] as const;
  const recipeDetailsQueryKey = ['recipe', householdId] as const;
  const recipeHouseholdQueryKey = ['recipe-household', userId] as const;
  await Promise.all([
    queryClient.cancelQueries({ queryKey: listQueryKey }),
    queryClient.cancelQueries({ queryKey: recipeListQueryKey }),
    queryClient.cancelQueries({ queryKey: recipeDetailsQueryKey }),
    queryClient.cancelQueries({ queryKey: recipeHouseholdQueryKey }),
  ]);
  queryClient.removeQueries({ queryKey: recipeListQueryKey });
  queryClient.removeQueries({ queryKey: recipeDetailsQueryKey });
  queryClient.removeQueries({ queryKey: recipeHouseholdQueryKey });
  const cachedLists = queryClient.getQueriesData<ShoppingList>({ queryKey: listQueryKey });
  const itemQueryKeys: QueryKey[] = cachedLists
    .map(([, list]) => list?.id)
    .filter((listId): listId is string => Boolean(listId))
    .map((listId) => ['shopping-items', listId]);

  await Promise.all([...itemQueryKeys.map((queryKey) => queryClient.cancelQueries({ queryKey }))]);
  for (const queryKey of itemQueryKeys) {
    queryClient.removeQueries({ queryKey });
  }
  queryClient.removeQueries({ queryKey: listQueryKey });
}
