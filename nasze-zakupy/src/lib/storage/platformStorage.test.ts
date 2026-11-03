import { createPlatformStorage } from './platformStorage';
import type { KeyValueStorage } from './platformStorage';

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

describe('platform storage adapter', () => {
  it('uses the native storage adapter on iOS', async () => {
    const nativeStorage: KeyValueStorage = {
      getItem: jest.fn().mockResolvedValue('native-value'),
      setItem: jest.fn().mockResolvedValue(undefined),
      removeItem: jest.fn().mockResolvedValue(undefined),
    };
    const storage = createPlatformStorage('ios', nativeStorage);

    await expect(storage.getItem('key')).resolves.toBe('native-value');
    await storage.setItem('key', 'value');
    await storage.removeItem('key');

    expect(nativeStorage.getItem).toHaveBeenCalledWith('key');
    expect(nativeStorage.setItem).toHaveBeenCalledWith('key', 'value');
    expect(nativeStorage.removeItem).toHaveBeenCalledWith('key');
  });

  it('uses localStorage in a browser', async () => {
    const localStorage = new Map<string, string>();
    const browserStorage: Storage = {
      getItem: jest.fn((key) => localStorage.get(key) ?? null),
      setItem: jest.fn((key, value) => {
        localStorage.set(key, value);
      }),
      removeItem: jest.fn((key) => {
        localStorage.delete(key);
      }),
      clear: () => localStorage.clear(),
      key: (index) => Array.from(localStorage.keys())[index] ?? null,
      get length() {
        return localStorage.size;
      },
    };
    const restoreWindow = setBrowserStorage(browserStorage);

    try {
      const storage = createPlatformStorage('web', {
        getItem: async () => null,
        setItem: async () => {},
        removeItem: async () => {},
      });

      await storage.setItem('key', 'browser-value');
      await expect(storage.getItem('key')).resolves.toBe('browser-value');
      await storage.removeItem('key');

      expect(browserStorage.setItem).toHaveBeenCalledWith('key', 'browser-value');
      expect(browserStorage.removeItem).toHaveBeenCalledWith('key');
    } finally {
      restoreWindow();
    }
  });

  it('uses no-op storage during SSR without a window', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'window');

    try {
      const nativeStorage: KeyValueStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
      };
      const storage = createPlatformStorage('web', nativeStorage);

      await expect(storage.getItem('key')).resolves.toBeNull();
      await expect(storage.setItem('key', 'value')).resolves.toBeUndefined();
      await expect(storage.removeItem('key')).resolves.toBeUndefined();
      expect(nativeStorage.getItem).not.toHaveBeenCalled();
      expect(nativeStorage.setItem).not.toHaveBeenCalled();
      expect(nativeStorage.removeItem).not.toHaveBeenCalled();
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      }
    }
  });
});
