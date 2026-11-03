import type { Href } from 'expo-router';

const HOUSEHOLD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_HOUSEHOLDS_PER_USER = 3;

export function hasHouseholdCapacity(householdCount: number): boolean {
  return householdCount < MAX_HOUSEHOLDS_PER_USER;
}

export function isValidHouseholdId(householdId: unknown): householdId is string {
  return typeof householdId === 'string' && HOUSEHOLD_ID_PATTERN.test(householdId);
}

export const householdRoutes = {
  root: () => '/households' as Href,
  list: () => '/households/list' as Href,
  invitations: (householdId?: string) =>
    ({
      pathname: '/households/invitations',
      params: householdId ? { householdId } : {},
    }) as Href,
  create: () => '/households/new' as Href,
  details: (householdId: string) => {
    if (!isValidHouseholdId(householdId)) {
      throw new Error('Nieprawidłowy identyfikator gospodarstwa.');
    }
    return {
      pathname: '/households/[householdId]',
      params: { householdId },
    } as Href;
  },
} as const;

export const householdQueryKeys = {
  memberships: (userId: string) => ['households', userId] as const,
  activeSelection: (userId: string) => ['active-household-selection', userId] as const,
};
