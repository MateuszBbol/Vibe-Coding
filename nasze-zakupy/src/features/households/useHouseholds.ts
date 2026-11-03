import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { logFeatureError } from '@/features/errors';
import { useSession } from '@/features/auth/SessionProvider';
import { fetchUserHouseholds } from '@/features/households/data';
import {
  readActiveHouseholdId,
  resolveActiveHouseholdId,
  saveActiveHouseholdId,
} from '@/features/households/selection';
import { householdQueryKeys } from '@/features/households/routes';

export function useHouseholds({ enabled = true }: { enabled?: boolean } = {}) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const membershipsQuery = useQuery({
    queryKey: householdQueryKeys.memberships(userId ?? ''),
    queryFn: () => fetchUserHouseholds(userId ?? ''),
    enabled: Boolean(userId && enabled),
  });
  const activeSelectionQuery = useQuery({
    queryKey: householdQueryKeys.activeSelection(userId ?? ''),
    queryFn: async () => {
      try {
        return await readActiveHouseholdId(userId ?? '');
      } catch (error) {
        logFeatureError('[household] restore active household failed', error, { userId });
        return null;
      }
    },
    enabled: Boolean(userId && enabled),
    staleTime: Infinity,
  });
  const households = membershipsQuery.data ?? [];
  const activeHouseholdId = resolveActiveHouseholdId(activeSelectionQuery.data ?? null, households);

  useEffect(() => {
    if (membershipsQuery.isError) {
      logFeatureError('[household] load memberships failed', membershipsQuery.error, { userId });
    }
  }, [membershipsQuery.error, membershipsQuery.isError, userId]);

  useEffect(() => {
    if (!userId || !membershipsQuery.data || !activeSelectionQuery.isSuccess) {
      return;
    }
    if (activeHouseholdId === activeSelectionQuery.data) {
      return;
    }

    queryClient.setQueryData(householdQueryKeys.activeSelection(userId), activeHouseholdId);
    void saveActiveHouseholdId(userId, activeHouseholdId).catch((error: unknown) => {
      logFeatureError('[household] persist active household failed', error, {
        userId,
        householdId: activeHouseholdId,
      });
    });
  }, [
    activeHouseholdId,
    activeSelectionQuery.data,
    activeSelectionQuery.isSuccess,
    membershipsQuery.data,
    queryClient,
    userId,
  ]);

  const selectActiveHousehold = async (householdId: string | null) => {
    const currentHouseholds =
      queryClient.getQueryData<typeof households>(householdQueryKeys.memberships(userId ?? '')) ??
      households;
    if (
      !userId ||
      (householdId !== null && !currentHouseholds.some((household) => household.id === householdId))
    ) {
      return;
    }

    queryClient.setQueryData(householdQueryKeys.activeSelection(userId), householdId);
    try {
      await saveActiveHouseholdId(userId, householdId);
    } catch (error) {
      logFeatureError('[household] persist selected household failed', error, {
        userId,
        householdId,
      });
    }
  };

  return {
    userId,
    households,
    membershipsQuery,
    activeHouseholdId,
    activeHousehold: households.find((household) => household.id === activeHouseholdId) ?? null,
    activeSelectionQuery,
    selectActiveHousehold,
  };
}
