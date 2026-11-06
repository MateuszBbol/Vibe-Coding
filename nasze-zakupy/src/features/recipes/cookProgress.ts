import { appStorage } from '@/lib/storage/appStorage';

// Progress of "Przyrządź" (cooking mode) is kept on this device only, per user and recipe.

export function getCookProgressStorageKey(userId: string, recipeId: string): string {
  const key = `recipe_cook.${userId.trim()}.${recipeId.trim()}`;
  if (!userId.trim() || !recipeId.trim() || !/^[A-Za-z0-9._-]+$/.test(key)) {
    throw new Error('Nieprawidłowy klucz postępu przepisu.');
  }
  return key;
}

// Only ids of steps that still exist are kept, so edited recipes do not keep stale ticks.
export function parseCookProgress(raw: string | null, stepIds: string[]): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const known = new Set(stepIds);
    return parsed.filter((id): id is string => typeof id === 'string' && known.has(id));
  } catch {
    return [];
  }
}

export async function readCookProgress(
  userId: string,
  recipeId: string,
  stepIds: string[],
): Promise<string[]> {
  const raw = await appStorage.getItem(getCookProgressStorageKey(userId, recipeId));
  return parseCookProgress(raw, stepIds);
}

export async function saveCookProgress(
  userId: string,
  recipeId: string,
  checkedStepIds: string[],
): Promise<void> {
  const key = getCookProgressStorageKey(userId, recipeId);
  if (checkedStepIds.length === 0) {
    await appStorage.removeItem(key);
    return;
  }
  await appStorage.setItem(key, JSON.stringify(checkedStepIds));
}

export function formatTimer(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
