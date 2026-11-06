import { strings } from './index';

function collectStringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStringValues);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStringValues);
  }
  return [];
}

describe('foundation translations', () => {
  it('provides Polish copy for the initial screen', () => {
    expect(strings.pl.appName).toBe('Home');
    expect(strings.pl.readyItems).toContain('Lista produktów na żywo');
    expect(strings.pl.readyItems).toContain('Dostęp chroniony przez RLS');
  });

  it('keeps the translation shape ready for English', () => {
    expect(strings.en.readyItems).toHaveLength(strings.pl.readyItems.length);
    expect(Object.keys(strings.en.recipes)).toEqual(Object.keys(strings.pl.recipes));
  });

  it('calls the shared container a space (Przestrzeń) and keeps "Lista zakupów" for products', () => {
    expect(collectStringValues(strings.pl).join(' ')).not.toMatch(/gospodarst/i);
    expect(collectStringValues(strings.en).join(' ')).not.toMatch(/households?/i);
    expect(strings.pl.navigation.lists).toBe('Przestrzenie');
    expect(strings.en.navigation.lists).toBe('Spaces');
    expect(strings.pl.household.managementTitle).toBe('Moje przestrzenie');
    expect(strings.pl.household.listTitle).toBe('Moje przestrzenie');
    expect(strings.pl.household.newHousehold).toBe('Nowa przestrzeń');
    expect(strings.pl.household.householdCount(3)).toBe('3 z 3 przestrzeni');
    expect(strings.pl.household.activeLabel).toBe('Aktywna przestrzeń');
    expect(strings.pl.household.leaveButton).toBe('Opuść przestrzeń');
    expect(strings.pl.household.deleteHouseholdButton).toBe('Usuń przestrzeń');
    expect(strings.pl.household.invitationsTitle).toBe('Udostępnianie przestrzeni');
    expect(strings.pl.household.joinTitle).toBe('Dołącz do przestrzeni');
    expect(strings.pl.household.inviteTitle).toBe('Udostępnij przestrzeń');
    expect(strings.pl.household.codeLabel).toBe('Kod zaproszenia do przestrzeni');
    expect(strings.pl.featureErrors.householdLimit).toBe(
      'Możesz korzystać maksymalnie z 3 przestrzeni.',
    );
    expect(strings.pl.featureErrors.deleteNotFound).toBe('Ta przestrzeń już nie istnieje.');
    expect(strings.pl.featureErrors.deleteOwnerOnly).toBe(
      'Tylko właściciel może usunąć tę przestrzeń.',
    );
    // The container is never called a "lista" any more; only the product list is.
    for (const value of collectStringValues(strings.pl.household)) {
      // "lista zakupów" / "listy zakupowej" refer to the product list and are allowed.
      expect(value).not.toMatch(/\blist(a|y|ę|ą)\b(?!\s+zakup)/i);
    }
    expect(strings.pl.shopping.toBuy).toBe('Lista zakupów');
    expect(strings.en.shopping.toBuy).toBe('Shopping list');
    expect(collectStringValues(strings.pl.shopping).join(' ')).not.toContain('Do kupienia');
  });
});
