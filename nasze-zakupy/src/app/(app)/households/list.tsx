import { Redirect } from 'expo-router';

import { householdRoutes } from '@/features/households/routes';

// The list overview now lives in the "Listy" section (/households). Keep the old URL working.
export default function HouseholdListRoute() {
  return <Redirect href={householdRoutes.root()} />;
}
