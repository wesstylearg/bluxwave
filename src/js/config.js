/**
 * config.js - Configuration & Settings manager for BluxWave
 */

import { Storage } from './storage.js';

const DEFAULT_SETTINGS = {
  youtubeApiKey: '',
  googleClientId: '677549544444-fog23hne9vjaoecrtih42pe28muj505m.apps.googleusercontent.com',
  volume: 80,
  autoplay: true,
  enableShortcuts: true,
  focusBackgroundGlow: true,
  lastPlayedId: null,
  customUsername: '',
  customAvatar: '',
  userBio: ''
};

class ConfigManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS, ...(Storage.get('settings') || {}) };

    // Fallback to Vite environment variable if localStorage has no key
    if (!this.settings.youtubeApiKey && import.meta.env?.VITE_YOUTUBE_API_KEY) {
      this.settings.youtubeApiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    }
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    Storage.set('settings', this.settings);
  }

  getApiKey() {
    return this.settings.youtubeApiKey || '';
  }

  setApiKey(key) {
    this.set('youtubeApiKey', (key || '').trim());
  }

  getClientId() {
    return this.settings.googleClientId || '';
  }

  setClientId(id) {
    this.set('googleClientId', (id || '').trim());
  }

  hasApiKey() {
    return Boolean(this.getApiKey() && this.getApiKey().length > 10);
  }

  getUsername() {
    return this.settings.customUsername || '';
  }

  setUsername(name) {
    this.set('customUsername', (name || '').trim());
  }

  getAvatar() {
    return this.settings.customAvatar || '';
  }

  setAvatar(avatar) {
    this.set('customAvatar', (avatar || '').trim());
  }

  getBio() {
    return this.settings.userBio || 'Explorando frecuencias y coleccionando música en BluxWave.';
  }

  setBio(bio) {
    this.set('userBio', (bio || '').trim());
  }
}

export const Config = new ConfigManager();
