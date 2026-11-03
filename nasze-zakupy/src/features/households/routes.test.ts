import {
  householdRoutes,
  hasHouseholdCapacity,
  isValidHouseholdId,
  MAX_HOUSEHOLDS_PER_USER,
} from './routes';

describe('household navigation routes', () => {
  const householdId = '550e8400-e29b-41d4-a716-446655440000';

  it('uses the parent route for the households landing screen', () => {
    expect(householdRoutes.root()).toBe('/households');
    expect(householdRoutes.root()).not.toContain('/index');
  });

  it('generates static routes for list, invitations, and creation', () => {
    expect(householdRoutes.list()).toBe('/households/list');
    expect(householdRoutes.invitations()).toEqual({
      pathname: '/households/invitations',
      params: {},
    });
    expect(householdRoutes.invitations(householdId)).toEqual({
      pathname: '/households/invitations',
      params: { householdId },
    });
    expect(householdRoutes.create()).toBe('/households/new');
  });

  it('generates a household details route with the UUID parameter', () => {
    expect(householdRoutes.details(householdId)).toEqual({
      pathname: '/households/[householdId]',
      params: { householdId },
    });
  });

  it.each(['index', 'list', 'invitations', 'new', '', undefined, null, 'undefined', 'null'])(
    'rejects invalid household ID "%s"',
    (id) => {
      expect(isValidHouseholdId(id)).toBe(false);
    },
  );

  it('accepts a UUID household ID', () => {
    expect(isValidHouseholdId(householdId)).toBe(true);
  });

  it('allows creation and joining only below the existing three-household limit', () => {
    expect(MAX_HOUSEHOLDS_PER_USER).toBe(3);
    expect(hasHouseholdCapacity(0)).toBe(true);
    expect(hasHouseholdCapacity(1)).toBe(true);
    expect(hasHouseholdCapacity(2)).toBe(true);
    expect(hasHouseholdCapacity(3)).toBe(false);
  });

  it.each(['index', 'list', 'invitations', 'new', ''])(
    'does not generate a details route for reserved or invalid ID "%s"',
    (id) => {
      expect(() => householdRoutes.details(id)).toThrow(
        'Nieprawidłowy identyfikator gospodarstwa.',
      );
    },
  );
});
