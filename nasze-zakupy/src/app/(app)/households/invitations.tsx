import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, useColorScheme } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { Colors } from '@/constants/theme';
import { HouseholdInvitation } from '@/features/households/HouseholdInvitation';
import { HouseholdSetup } from '@/features/households/HouseholdSetup';
import {
  HouseholdButton,
  HouseholdFrame,
  HouseholdMessage,
} from '@/features/households/HouseholdUI';
import {
  hasHouseholdCapacity,
  householdQueryKeys,
  isValidHouseholdId,
} from '@/features/households/routes';
import { useHouseholds } from '@/features/households/useHouseholds';
import type { Household } from '@/features/households/data';
import { appSectionHrefs } from '@/components/AppBottomNav';
import { strings } from '@/localization';

function isHouseholdOwner(household: Household, userId: string): boolean {
  return household.role === 'owner' && household.owner_id === userId;
}

// With a householdId this screen shares that one list (opened from the list itself).
// Without it, the screen is only the entry point for joining a list with a code.
export default function HouseholdInvitationsRoute() {
  const params = useLocalSearchParams<{ householdId?: string | string[] }>();
  const requestedHouseholdId = Array.isArray(params.householdId)
    ? params.householdId[0]
    : params.householdId;
  const { userId, households, membershipsQuery, selectActiveHousehold } = useHouseholds();
  const queryClient = useQueryClient();
  const dark = useColorScheme() === 'dark';
  const colors = Colors[dark ? 'dark' : 'light'];
  const text = strings.pl.household;
  const isShareMode = Boolean(requestedHouseholdId);
  const sharedHousehold =
    userId && isValidHouseholdId(requestedHouseholdId)
      ? households.find(
          (household) =>
            household.id === requestedHouseholdId && isHouseholdOwner(household, userId),
        )
      : undefined;
  const atMembershipLimit = !hasHouseholdCapacity(households.length);

  const completeJoin = async (householdId: string) => {
    const result = await membershipsQuery.refetch();
    if (!result.data?.some((household) => household.id === householdId)) {
      return;
    }
    await selectActiveHousehold(householdId);
    await queryClient.invalidateQueries({
      queryKey: householdQueryKeys.memberships(userId ?? ''),
    });
    // The new group is now active: open its default section and clear the setup screens.
    router.dismissAll();
    router.replace(appSectionHrefs.todo);
  };

  return (
    <HouseholdFrame
      title={isShareMode ? (sharedHousehold?.name ?? text.invitationsTitle) : text.joinTitle}
      testID="households-invitations-screen"
      onBack={() => router.back()}
    >
      {membershipsQuery.isPending ? (
        <ActivityIndicator
          testID="households-invitations-loading"
          color={colors.accent}
          size="large"
        />
      ) : membershipsQuery.isError ? (
        <>
          <HouseholdMessage testID="households-invitations-error-message">
            {text.householdsLoadFailed}
          </HouseholdMessage>
          <HouseholdButton
            label={text.retryHouseholds}
            testID="households-retry-button"
            onPress={() => void membershipsQuery.refetch()}
          />
        </>
      ) : isShareMode ? (
        sharedHousehold ? (
          <HouseholdInvitation key={sharedHousehold.id} household={sharedHousehold} />
        ) : (
          <HouseholdMessage testID="households-no-owned-state">
            {text.noOwnedHouseholds}
          </HouseholdMessage>
        )
      ) : atMembershipLimit ? (
        <HouseholdSetup
          userId={userId ?? ''}
          embedded
          hideEmbeddedHeading
          showCreate={false}
          joinDisabled
          joinDisabledMessage={text.joinLimitMessage}
        />
      ) : userId ? (
        <HouseholdSetup
          userId={userId}
          embedded
          hideEmbeddedHeading
          showCreate={false}
          onCompleted={completeJoin}
        />
      ) : null}
    </HouseholdFrame>
  );
}
