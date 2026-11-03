jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('Supabase client in a static rendering environment', () => {
  it('initializes without browser storage when Platform is web and window is absent', async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    Reflect.deleteProperty(globalThis, 'window');
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';

    try {
      jest.isolateModules(() => {
        const { isSupabaseConfigured, supabase } =
          jest.requireActual<typeof import('./client')>('./client');
        expect(isSupabaseConfigured).toBe(true);
        expect(supabase).not.toBeNull();
      });
    } finally {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      }
      if (originalUrl === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
      }
      if (originalKey === undefined) {
        delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      } else {
        process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
      }
    }
  });
});
