import { appStorage } from '@/lib/storage/appStorage';
import type { Household } from './data';

export function getActiveHouseholdStorageKey(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Identyfikator użytkownika nie może być pusty.');
  }

  const key = `active_household.${normalizedUserId}`;
  if (!key || !/^[A-Za-z0-9._-]+$/.test(key)) {
    throw new Error('Identyfikator użytkownika zawiera niedozwolone znaki.');
  }
  return key;
}

export async function readActiveHouseholdId(userId: string): Promise<string | null> {
  const key = getActiveHouseholdStorageKey(userId);
  return appStorage.getItem(key);
}

export async function saveActiveHouseholdId(
  userId: string,
  householdId: string | null,
): Promise<void> {
  const key = getActiveHouseholdStorageKey(userId);
  if (householdId) {
    await appStorage.setItem(key, householdId);
  } else {
    await appStorage.removeItem(key);
  }
}

export async function clearActiveHouseholdId(userId: string): Promise<void> {
  const key = getActiveHouseholdStorageKey(userId);
  await appStorage.removeItem(key);
}

export function resolveActiveHouseholdId(
  savedHouseholdId: string | null,
  households: Household[],
): string | null {
  if (savedHouseholdId && households.some((household) => household.id === savedHouseholdId)) {
    return savedHouseholdId;
  }
  return households[0]?.id ?? null;
}

export function resolveHouseholdAfterDeletion(
  activeHouseholdId: string,
  deletedHouseholdId: string,
  households: Household[],
): string | null {
  if (
    activeHouseholdId !== deletedHouseholdId &&
    households.some((household) => household.id === activeHouseholdId)
  ) {
    return activeHouseholdId;
  }
  return resolveActiveHouseholdId(null, households);
}
