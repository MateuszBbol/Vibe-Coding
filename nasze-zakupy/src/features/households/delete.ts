import type { Household } from './data';

export type HouseholdAction = 'leave' | 'delete';

export function getHouseholdAction(household: Household, userId: string): HouseholdAction {
  return household.role === 'owner' && household.owner_id === userId ? 'delete' : 'leave';
}

export function isHouseholdNameConfirmationValid(
  confirmation: string,
  householdName: string,
): boolean {
  return confirmation.trim() === householdName.trim();
}
