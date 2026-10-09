import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './kv';

/** Almacén real de la app (datos no sensibles: récords y ajustes). */
export const asyncStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
