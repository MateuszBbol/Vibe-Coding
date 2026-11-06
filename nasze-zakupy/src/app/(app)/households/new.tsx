import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { hasHouseholdCapacity, householdQueryKeys } from '@/features/households/routes';
import { HouseholdSetup } from '@/features/households/HouseholdSetup';
import {
  HouseholdButton,
  HouseholdFrame,
  HouseholdMessage,
} from '@/features/households/HouseholdUI';
import { useHouseholds } from '@/features/households/useHouseholds';
import { appSectionHrefs } from '@/components/AppBottomNav';
import { strings } from '@/localization';
import { Colors } from '@/constants/theme';

export default function NewHouseholdRoute() {
  const { userId, households, membershipsQuery, selectActiveHousehold } = useHouseholds();
  const queryClient = useQueryClient();
  const text = strings.pl.household;

  const completeCreation = async (householdId: string) => {
    await membershipsQuery.refetch();
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
      title={text.newHousehold}
      testID="household-create-screen"
      onBack={() => router.back()}
    >
      {!userId || membershipsQuery.isPending ? (
        <ActivityIndicator
          testID="household-create-loading"
          color={Colors.light.accent}
          size="large"
        />
      ) : membershipsQuery.isError ? (
        <>
          <HouseholdMessage testID="household-create-error-message">
            {text.householdsLoadFailed}
          </HouseholdMessage>
          <HouseholdButton
            label={text.retryHouseholds}
            testID="households-retry-button"
            onPress={() => void membershipsQuery.refetch()}
          />
        </>
      ) : !hasHouseholdCapacity(households.length) ? (
        <HouseholdMessage testID="households-limit-message">{text.householdLimit}</HouseholdMessage>
      ) : (
        <HouseholdSetup
          userId={userId}
          embedded
          hideEmbeddedHeading
          showJoin={false}
          onCancel={() => router.back()}
          onCompleted={completeCreation}
        />
      )}
    </HouseholdFrame>
  );
}
