export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const emptyStorage: KeyValueStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

export function createPlatformStorage(
  platform: string,
  nativeStorage: KeyValueStorage,
): KeyValueStorage {
  const getStorage = (): KeyValueStorage | null => {
    if (platform !== 'web') {
      return nativeStorage;
    }

    if (typeof window === 'undefined') {
      return emptyStorage;
    }

    return {
      getItem: async (key) => window.localStorage.getItem(key),
      setItem: async (key, value) => window.localStorage.setItem(key, value),
      removeItem: async (key) => window.localStorage.removeItem(key),
    };
  };

  return {
    getItem: async (key) => (await getStorage()?.getItem(key)) ?? null,
    setItem: async (key, value) => {
      await getStorage()?.setItem(key, value);
    },
    removeItem: async (key) => {
      await getStorage()?.removeItem(key);
    },
  };
}
