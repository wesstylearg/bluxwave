/**
 * config.js - Configuration manager for BluxWave (Demo Portfolio Edition)
 * No API Keys required
 */

import { Storage } from './storage.js';

export const DEFAULT_YOUTUBE_API_KEY = '';

const DEFAULT_SETTINGS = {
  youtubeApiKey: '',
  googleClientId: '',
  volume: 80,
  autoplay: true,
  enableShortcuts: true,
  focusBackgroundGlow: true,
  lastPlayedId: null,
  customUsername: 'Melómano',
  customAvatar: '',
  userBio: 'Explorando la colección de Rock Nacional Argentino en BluxWave.'
};

class ConfigManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS, ...(Storage.get('settings') || {}) };
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    Storage.set('settings', this.settings);
  }

  getApiKey() {
    return '';
  }

  setApiKey() {}

  getClientId() {
    return '';
  }

  setClientId() {}

  hasApiKey() {
    return false;
  }

  getUsername() {
    return this.settings.customUsername || 'Melómano';
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
    return this.settings.userBio || 'Explorando la colección de Rock Nacional Argentino en BluxWave.';
  }

  setBio(bio) {
    this.set('userBio', (bio || '').trim());
  }
}

export const Config = new ConfigManager();
