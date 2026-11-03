import {
  getActiveHouseholdStorageKey,
  resolveActiveHouseholdId,
  resolveHouseholdAfterDeletion,
} from './selection';
import type { Household } from './data';

const households: Household[] = [
  {
    id: 'household-1',
    name: 'Dom 1',
    owner_id: 'user-1',
    role: 'owner',
    joined_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'household-2',
    name: 'Dom 2',
    owner_id: 'user-2',
    role: 'member',
    joined_at: '2026-01-02T00:00:00.000Z',
  },
];

describe('active household resolution', () => {
  it('restores a saved household when the user is still a member', () => {
    expect(resolveActiveHouseholdId('household-2', households)).toBe('household-2');
  });

  describe('active household SecureStore key', () => {
    const userId = 'e525d26a-ab21-46a1-aa81-8c5f9b265816';

    it('uses the SecureStore-safe key format for a user UUID', () => {
      const key = getActiveHouseholdStorageKey(userId);

      expect(key).toBe(`active_household.${userId}`);
      expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
      expect(key).not.toContain(':');
    });

    it('trims the user ID and rejects an empty ID', () => {
      expect(getActiveHouseholdStorageKey(` ${userId} `)).toBe(`active_household.${userId}`);
      expect(() => getActiveHouseholdStorageKey('   ')).toThrow(
        'Identyfikator użytkownika nie może być pusty.',
      );
    });

    it('rejects user IDs that would create an invalid SecureStore key', () => {
      expect(() => getActiveHouseholdStorageKey('user:id')).toThrow(
        'Identyfikator użytkownika zawiera niedozwolone znaki.',
      );
    });
  });

  it('falls back to the first membership if the saved household is no longer available', () => {
    expect(resolveActiveHouseholdId('left-household', households)).toBe('household-1');
  });

  it('uses the first existing membership when there is no restorable saved selection', () => {
    expect(resolveActiveHouseholdId(null, households)).toBe('household-1');
  });

  it('returns null when the user has no household memberships', () => {
    expect(resolveActiveHouseholdId('household-1', [])).toBeNull();
  });

  it('switches from a deleted active household to another available one', () => {
    expect(resolveHouseholdAfterDeletion('household-1', 'household-1', households.slice(1))).toBe(
      'household-2',
    );
  });

  it('preserves the active household when a different household is deleted', () => {
    expect(
      resolveHouseholdAfterDeletion('household-1', 'household-2', households.slice(0, 1)),
    ).toBe('household-1');
  });

  it('returns null after the final household is deleted', () => {
    expect(resolveHouseholdAfterDeletion('household-1', 'household-1', [])).toBeNull();
  });
});
