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

  it('calls the shared container a place (Miejsce) and keeps "Lista zakupów" for products', () => {
    expect(collectStringValues(strings.pl).join(' ')).not.toMatch(/gospodarst/i);
    expect(collectStringValues(strings.en).join(' ')).not.toMatch(/households?/i);
    expect(strings.pl.navigation.lists).toBe('Miejsca');
    expect(strings.en.navigation.lists).toBe('Places');
    expect(strings.pl.household.managementTitle).toBe('Moje miejsca');
    expect(strings.pl.household.listTitle).toBe('Moje miejsca');
    expect(strings.pl.household.newHousehold).toBe('Nowe miejsce');
    expect(strings.pl.household.householdCount(3)).toBe('3 z 3 miejsc');
    expect(strings.pl.household.activeLabel).toBe('Aktywne miejsce');
    expect(strings.pl.household.leaveButton).toBe('Opuść miejsce');
    expect(strings.pl.household.deleteHouseholdButton).toBe('Usuń miejsce');
    expect(strings.pl.household.invitationsTitle).toBe('Udostępnianie miejsca');
    expect(strings.pl.household.joinTitle).toBe('Dołącz do miejsca');
    expect(strings.pl.household.inviteTitle).toBe('Udostępnij miejsce');
    expect(strings.pl.household.codeLabel).toBe('Kod zaproszenia do miejsca');
    expect(strings.pl.featureErrors.householdLimit).toBe(
      'Możesz korzystać maksymalnie z 3 miejsc.',
    );
    expect(strings.pl.featureErrors.deleteNotFound).toBe('To miejsce już nie istnieje.');
    expect(strings.pl.featureErrors.deleteOwnerOnly).toBe(
      'Tylko właściciel może usunąć to miejsce.',
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
