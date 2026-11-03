import { router } from 'expo-router';

import { householdRoutes } from '@/features/households/routes';
import { HouseholdFrame, HouseholdNavigationRow } from '@/features/households/HouseholdUI';
import { strings } from '@/localization';

export default function HouseholdsRoute() {
  const text = strings.pl.household;

  return (
    <HouseholdFrame
      title={text.managementTitle}
      testID="households-management-screen"
      onBack={() => router.back()}
    >
      <HouseholdNavigationRow
        title={`🏠 ${text.openHouseholdList}`}
        testID="navigation-household-list"
        onPress={() => router.push(householdRoutes.list())}
      />
      <HouseholdNavigationRow
        title={`✉️ ${text.openInvitations}`}
        testID="navigation-household-invitations"
        onPress={() => router.push(householdRoutes.invitations())}
      />
    </HouseholdFrame>
  );
}
