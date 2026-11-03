const { readFileSync } = require('fs');
const { resolve } = require('path');

const appRoot = resolve(__dirname, '../../src/app/(app)');
const routes = readFileSync(
  resolve(__dirname, '../../src/features/households/routes.ts'),
  'utf8',
).toLowerCase();
const shopping = readFileSync(
  resolve(__dirname, '../../src/features/shopping/ShoppingHome.tsx'),
  'utf8',
).toLowerCase();
const details = readFileSync(
  resolve(appRoot, 'households/[householdId].tsx'),
  'utf8',
).toLowerCase();
const userScreens = [
  'households/index.tsx',
  'households/list.tsx',
  'households/invitations.tsx',
  'households/new.tsx',
  'households/[householdId].tsx',
]
  .map((file) => readFileSync(resolve(appRoot, file), 'utf8'))
  .concat([
    readFileSync(resolve(appRoot, '../../features/households/HouseholdSetup.tsx'), 'utf8'),
    readFileSync(resolve(appRoot, '../../features/households/HouseholdInvitation.tsx'), 'utf8'),
    readFileSync(resolve(appRoot, '../../features/shopping/ShoppingHome.tsx'), 'utf8'),
  ])
  .join('\n');

describe('household navigation contract', () => {
  it('uses the parent route for households and never navigates to /index', () => {
    expect(routes).toContain("root: () => '/households'");
    expect(routes).not.toContain("pathname: '/households/index'");
    expect(shopping).toContain('router.push(householdroutes.root())');
  });

  it('provides separate list, invitation, creation, and household details routes', () => {
    expect(routes).toContain("list: () => '/households/list'");
    expect(routes).toContain("pathname: '/households/invitations'");
    expect(routes).toContain("create: () => '/households/new'");
    expect(routes).toContain("pathname: '/households/[householdid]'");
  });

  it('keeps household management and invitation UI off the shopping screen', () => {
    expect(shopping).toContain('householdroutes.root()');
    expect(shopping).not.toContain('householdinvitation');
    expect(shopping).not.toContain('householdswitcher');
  });

  it('validates dynamic household IDs before mounting the data-loading screen', () => {
    const validation = details.indexOf('if (!isvalidhouseholdid(householdid))');
    const detailsScreen = details.indexOf(
      'return <validhouseholddetails householdid={householdid} />',
    );
    expect(validation).toBeGreaterThan(-1);
    expect(detailsScreen).toBeGreaterThan(validation);
  });

  it('does not render legacy household terminology in user-facing screens', () => {
    for (const legacyLabel of [
      'Gospodarstwa',
      'Lista gospodarstw',
      'Utwórz gospodarstwo',
      'Opuść gospodarstwo',
      'Usuń gospodarstwo',
      'Dołącz do gospodarstwa',
    ]) {
      expect(userScreens).not.toContain(legacyLabel);
    }
  });
});
