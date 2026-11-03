import type { Household } from './data';
import { getHouseholdAction, isHouseholdNameConfirmationValid } from './delete';

const ownerHousehold: Household = {
  id: 'household-1',
  name: 'Nasz Dom',
  owner_id: 'owner-1',
  role: 'owner',
  joined_at: '2026-10-28T00:00:00.000Z',
};

describe('household deletion confirmation', () => {
  it('offers delete only to the actual owner membership', () => {
    expect(getHouseholdAction(ownerHousehold, 'owner-1')).toBe('delete');
    expect(getHouseholdAction({ ...ownerHousehold, role: 'member' }, 'owner-1')).toBe('leave');
    expect(getHouseholdAction(ownerHousehold, 'member-1')).toBe('leave');
  });

  it('requires an exact household name after trimming surrounding whitespace', () => {
    expect(isHouseholdNameConfirmationValid('  Nasz Dom  ', 'Nasz Dom')).toBe(true);
    expect(isHouseholdNameConfirmationValid('nasz dom', 'Nasz Dom')).toBe(false);
    expect(isHouseholdNameConfirmationValid('Nasz Dom!', 'Nasz Dom')).toBe(false);
    expect(isHouseholdNameConfirmationValid('Nasz Dom', 'Nasz Dóm')).toBe(false);
  });
});
