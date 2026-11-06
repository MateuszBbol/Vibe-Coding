import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { logFeatureError } from '@/features/errors';
import { fetchUserHouseholds } from '@/features/households/data';
import { readActiveHouseholdId, resolveActiveHouseholdId } from '@/features/households/selection';
import { useHouseholds } from '@/features/households/useHouseholds';
import { useSession } from '@/features/auth/SessionProvider';
import type { Household } from '@/features/households/data';

async function findAccessibleHousehold(
  userId: string,
  requestedHouseholdId: string | undefined,
  selectedHouseholdId: string | null,
): Promise<Household | null> {
  const households = await fetchUserHouseholds(userId);
  if (requestedHouseholdId) {
    // Explicit household in the URL: never silently switch to another household.
    return households.find(({ id }) => id === requestedHouseholdId) ?? null;
  }

  let savedHouseholdId = selectedHouseholdId;
  if (!savedHouseholdId) {
    try {
      savedHouseholdId = await readActiveHouseholdId(userId);
    } catch (error) {
      logFeatureError('[recipes] restore active household failed', error, { userId });
    }
  }

  const fallbackId = resolveActiveHouseholdId(savedHouseholdId, households);
  return households.find(({ id }) => id === fallbackId) ?? null;
}

export function useRecipeHousehold() {
  const { session } = useSession();
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const userId = session?.user.id;
  const requestedHouseholdId = Array.isArray(params.householdId)
    ? params.householdId[0]
    : params.householdId;
  // Without an explicit household, follow the app-wide active list. Keying the query on it
  // prevents showing (and creating) recipes of the previously active list after a switch.
  const { activeSelectionQuery } = useHouseholds({ enabled: !requestedHouseholdId });
  const selectedHouseholdId = requestedHouseholdId ? null : (activeSelectionQuery.data ?? null);
  const query = useQuery({
    queryKey: ['recipe-household', userId, requestedHouseholdId, selectedHouseholdId],
    queryFn: () => findAccessibleHousehold(userId ?? '', requestedHouseholdId, selectedHouseholdId),
    enabled: Boolean(userId) && (Boolean(requestedHouseholdId) || !activeSelectionQuery.isPending),
  });

  return { userId, household: query.data ?? null, query };
}
