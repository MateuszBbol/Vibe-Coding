import {
  formatTimer,
  getCookProgressStorageKey,
  parseCookProgress,
  readCookProgress,
  saveCookProgress,
} from './cookProgress';

// jest.mock is hoisted above the import by babel-jest.
const mockStore = new Map<string, string>();

jest.mock('@/lib/storage/appStorage', () => ({
  appStorage: {
    getItem: async (key: string) => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStore.set(key, value);
    },
    removeItem: async (key: string) => {
      mockStore.delete(key);
    },
  },
}));

const userId = '11111111-1111-4111-8111-111111111111';
const recipeId = 'c1000000-0000-4000-8000-000000000001';

describe('cooking progress', () => {
  beforeEach(() => mockStore.clear());

  it('uses one storage key per user and recipe', () => {
    expect(getCookProgressStorageKey(userId, recipeId)).toBe(`recipe_cook.${userId}.${recipeId}`);
    expect(() => getCookProgressStorageKey('', recipeId)).toThrow();
    expect(() => getCookProgressStorageKey(userId, 'bad id')).toThrow();
  });

  it('saves, restores and clears checked steps on this device', async () => {
    await saveCookProgress(userId, recipeId, ['step-1', 'step-3']);
    await expect(
      readCookProgress(userId, recipeId, ['step-1', 'step-2', 'step-3']),
    ).resolves.toEqual(['step-1', 'step-3']);
    await saveCookProgress(userId, recipeId, []);
    expect(mockStore.size).toBe(0);
    await expect(readCookProgress(userId, recipeId, ['step-1'])).resolves.toEqual([]);
  });

  it('drops steps that no longer exist and ignores broken data', () => {
    expect(parseCookProgress('["a","gone","b"]', ['a', 'b'])).toEqual(['a', 'b']);
    expect(parseCookProgress('not json', ['a'])).toEqual([]);
    expect(parseCookProgress('{"a":true}', ['a'])).toEqual([]);
    expect(parseCookProgress(null, ['a'])).toEqual([]);
  });

  it('formats the timer as minutes and seconds', () => {
    expect(formatTimer(5 * 60 * 1000)).toBe('5:00');
    expect(formatTimer(61_500)).toBe('1:02');
    expect(formatTimer(0)).toBe('0:00');
    expect(formatTimer(-100)).toBe('0:00');
  });
});
