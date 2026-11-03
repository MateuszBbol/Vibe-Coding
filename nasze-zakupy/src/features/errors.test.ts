import { getFeatureErrorMessage } from './errors';
import { strings } from '@/localization';

const deletionErrors: [string, keyof typeof strings.pl.featureErrors][] = [
  ['Authentication required.', 'deleteAuthRequired'],
  ['Household not found.', 'deleteNotFound'],
  ['Only the household owner can delete the household.', 'deleteOwnerOnly'],
  ['Household confirmation does not match.', 'deleteConfirmationMismatch'],
];

describe('household error messages', () => {
  it('explains when a user has reached the household membership limit', () => {
    expect(getFeatureErrorMessage(new Error('Household limit reached.'))).toBe(
      strings.pl.featureErrors.householdLimit,
    );
  });

  it('translates unavailable household errors into shopping-list language', () => {
    expect(getFeatureErrorMessage(new Error('Household unavailable.'))).toBe(
      strings.pl.recipes.householdUnavailable,
    );
    expect(getFeatureErrorMessage(new Error('No accessible household was found.'))).toBe(
      strings.pl.recipes.householdUnavailable,
    );
  });

  it('explains why an owner cannot leave a household', () => {
    expect(getFeatureErrorMessage(new Error('Household owner cannot leave.'))).toBe(
      strings.pl.featureErrors.ownerCannotLeave,
    );
  });

  it('prevents a member from leaving as the final household member', () => {
    expect(getFeatureErrorMessage(new Error('The last household member cannot leave.'))).toBe(
      strings.pl.featureErrors.lastHouseholdMember,
    );
  });

  it.each(deletionErrors)(
    'maps destructive RPC error "%s" to a friendly message',
    (message, key) => {
      expect(getFeatureErrorMessage(new Error(message))).toBe(strings.pl.featureErrors[key]);
    },
  );
});
