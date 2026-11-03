import { clearActiveHouseholdId, readActiveHouseholdId, saveActiveHouseholdId } from './selection';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

function setBrowserStorage(storage: Storage): () => void {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });

  return () => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  };
}

function createBrowserStorage(): Storage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
  };
}

describe('active household storage in web environments', () => {
  it('uses browser localStorage for active household selection', async () => {
    const restoreWindow = setBrowserStorage(createBrowserStorage());
    const userId = 'user-1';

    try {
      await saveActiveHouseholdId(userId, 'household-1');
      await expect(readActiveHouseholdId(userId)).resolves.toBe('household-1');
      await clearActiveHouseholdId(userId);
      await expect(readActiveHouseholdId(userId)).resolves.toBeNull();
    } finally {
      restoreWindow();
    }
  });

  it('does not access browser or native storage during static rendering', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'window');

    try {
      await expect(readActiveHouseholdId('user-1')).resolves.toBeNull();
      await expect(saveActiveHouseholdId('user-1', 'household-1')).resolves.toBeUndefined();
      await expect(clearActiveHouseholdId('user-1')).resolves.toBeUndefined();

      const secureStore = jest.requireMock('expo-secure-store') as {
        getItemAsync: jest.Mock;
        setItemAsync: jest.Mock;
        deleteItemAsync: jest.Mock;
      };
      expect(secureStore.getItemAsync).not.toHaveBeenCalled();
      expect(secureStore.setItemAsync).not.toHaveBeenCalled();
      expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      }
    }
  });
});
