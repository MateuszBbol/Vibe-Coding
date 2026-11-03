import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { createPlatformStorage } from './platformStorage';

export const appStorage = createPlatformStorage(Platform.OS, {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
});
