/**
 * storage.js - Local persistence abstraction for BluxWave
 */

const STORAGE_PREFIX = 'bluxwave_';

export const Storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error(`[Storage] Error reading ${key}:`, e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`[Storage] Error saving ${key}:`, e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return true;
    } catch (e) {
      console.error(`[Storage] Error removing ${key}:`, e);
      return false;
    }
  }
};
