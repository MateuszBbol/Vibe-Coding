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

  it('uses shopping-list terminology in all user-facing Polish and English copy', () => {
    expect(collectStringValues(strings.pl).join(' ')).not.toMatch(/gospodarst/i);
    expect(collectStringValues(strings.en).join(' ')).not.toMatch(/households?/i);
    expect(strings.pl.household.managementTitle).toBe('Moje listy');
    expect(strings.pl.household.listTitle).toBe('Moje listy');
    expect(strings.pl.household.newHousehold).toBe('Nowa lista zakupowa');
    expect(strings.pl.household.householdCount(3)).toBe('3 z 3 list');
    expect(strings.pl.household.activeLabel).toBe('Aktywna lista');
    expect(strings.pl.household.leaveButton).toBe('Opuść listę');
    expect(strings.pl.household.deleteHouseholdButton).toBe('Usuń listę');
    expect(strings.pl.household.invitationsTitle).toBe('Udostępnianie listy');
    expect(strings.pl.household.joinTitle).toBe('Dołącz do listy');
    expect(strings.pl.household.inviteTitle).toBe('Udostępnij listę');
    expect(strings.pl.household.codeLabel).toBe('Kod zaproszenia do listy');
    expect(strings.pl.featureErrors.householdLimit).toBe(
      'Możesz korzystać maksymalnie z 3 list zakupowych.',
    );
    expect(strings.pl.featureErrors.deleteNotFound).toBe('Ta lista zakupowa już nie istnieje.');
    expect(strings.pl.featureErrors.deleteOwnerOnly).toBe('Tylko właściciel może usunąć tę listę.');
    expect(strings.pl.shopping.toBuy).toBe('Lista');
    expect(strings.en.shopping.toBuy).toBe('List');
    expect(collectStringValues(strings.pl.shopping).join(' ')).not.toContain('Do kupienia');
  });
});
