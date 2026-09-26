/**
 * sync.js - Automatic Cloud Sync with Google Drive AppData Folder
 * Stores playlists, CD collection, and user profile data in the user's private Google account.
 */

import { Auth } from './auth.js';
import { Storage } from './storage.js';
import { Playlists } from './playlists.js';
import { CDCollection } from './collection.js';

const SYNC_FILENAME = 'bluxwave_cloud_sync.json';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

class CloudSyncManager {
  constructor() {
    this.isSyncing = false;
    this.debounceTimer = null;
    this.lastSyncedAt = Storage.get('last_cloud_sync') || null;
  }

  init() {
    // Listen for auth changes: when user logs in, trigger automatic sync
    Auth.subscribe(async (data) => {
      const token = Auth.getAccessToken();
      if (token) {
        console.log('[CloudSync] Logged in, initiating auto-sync with Google Drive...');
        await this.sync();
      }
    });

    // Auto-sync on app boot if already authenticated
    if (Auth.isAuthenticated()) {
      setTimeout(() => {
        this.sync();
      }, 1500);
    }
  }

  /**
   * Schedule debounced upload when local data changes
   */
  scheduleUpload(delayMs = 2500) {
    if (!Auth.isAuthenticated()) return;
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.uploadToCloud();
    }, delayMs);
  }

  /**
   * Find sync file in Google Drive AppData folder
   */
  async findSyncFile(token) {
    try {
      const q = encodeURIComponent(`name = '${SYNC_FILENAME}' and 'appDataFolder' in parents and trashed = false`);
      const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        console.warn('[CloudSync] Could not list appDataFolder:', res.status);
        return null;
      }
      const data = await res.json();
      return (data.files && data.files.length > 0) ? data.files[0] : null;
    } catch (e) {
      console.error('[CloudSync] Error searching for file:', e);
      return null;
    }
  }

  /**
   * Download content of existing sync file
   */
  async downloadSyncFile(token, fileId) {
    try {
      const res = await fetch(`${DRIVE_FILES_URL}/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[CloudSync] Error downloading sync file:', e);
      return null;
    }
  }

  /**
   * Perform bidirectional sync:
   * Downloads remote if exists, merges with local, updates local, and uploads merged result back.
   */
  async sync() {
    if (this.isSyncing) return;
    const token = Auth.getAccessToken();
    if (!token) return;

    this.isSyncing = true;
    console.log('[CloudSync] Starting bidirectional sync with Google Drive AppData...');

    try {
      const existingFile = await this.findSyncFile(token);

      if (existingFile) {
        const remoteData = await this.downloadSyncFile(token, existingFile.id);
        if (remoteData) {
          this.mergeRemoteData(remoteData);
        }
        // Save merged state back to remote file
        await this.updateRemoteFile(token, existingFile.id);
      } else {
        // Create initial sync file in AppData folder
        await this.createRemoteFile(token);
      }

      this.lastSyncedAt = new Date().toISOString();
      Storage.set('last_cloud_sync', this.lastSyncedAt);
      console.log('[CloudSync] Sync completed successfully at', this.lastSyncedAt);

      if (window.bluxUI?.showToast) {
        window.bluxUI.showToast('Playlists sincronizadas con tu Google Drive ✓');
      }
    } catch (err) {
      console.error('[CloudSync] Sync error:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Intelligently merges remote data into local Storage
   */
  mergeRemoteData(remoteData) {
    let plChanged = false;

    // 1. Playlists
    if (Array.isArray(remoteData.playlists)) {
      const localPlaylists = Playlists.getAll();
      const localMap = new Map(localPlaylists.map(p => [p.id, p]));

      remoteData.playlists.forEach(remotePl => {
        if (!remotePl || !remotePl.id) return;
        const localPl = localMap.get(remotePl.id);
        if (!localPl) {
          localPlaylists.push(remotePl);
          plChanged = true;
        } else {
          // Merge songs inside playlist without duplicates
          const localSongIds = new Set(localPl.songs.map(s => s.id));
          (remotePl.songs || []).forEach(s => {
            if (s && s.id && !localSongIds.has(s.id)) {
              localPl.songs.push(s);
              plChanged = true;
            }
          });
        }
      });

      if (plChanged) {
        Storage.set('playlists', localPlaylists);
        Playlists.reload();
      }
    }

    // 2. CD Collection
    if (Array.isArray(remoteData.cd_collection)) {
      const localCollection = CDCollection.getAll();
      const localIds = new Set(localCollection.map(c => String(c.id)));
      let collChanged = false;

      remoteData.cd_collection.forEach(remoteCD => {
        if (remoteCD && remoteCD.id && !localIds.has(String(remoteCD.id))) {
          localCollection.unshift(remoteCD);
          collChanged = true;
        }
      });

      if (collChanged) {
        Storage.set('cd_collection', localCollection);
        CDCollection.reload();
      }
    }

    // 3. User profile settings
    if (remoteData.profile) {
      const { customUsername, userBio } = remoteData.profile;
      const settings = Storage.get('settings') || {};
      let settingsChanged = false;

      if (!settings.customUsername && customUsername) {
        settings.customUsername = customUsername;
        settingsChanged = true;
      }
      if (!settings.userBio && userBio) {
        settings.userBio = userBio;
        settingsChanged = true;
      }
      if (settingsChanged) {
        Storage.set('settings', settings);
      }
    }
  }

  /**
   * Prepares payload for Drive
   */
  getLocalPayload() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      playlists: Playlists.getAll(),
      cd_collection: CDCollection.getAll(),
      profile: {
        customUsername: Storage.get('settings')?.customUsername || '',
        userBio: Storage.get('settings')?.userBio || ''
      }
    };
  }

  /**
   * Update existing file in Drive AppData
   */
  async updateRemoteFile(token, fileId) {
    const payload = JSON.stringify(this.getLocalPayload());
    const res = await fetch(`${DRIVE_UPLOAD_URL}/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: payload
    });
    return res.ok;
  }

  /**
   * Create new file in Google Drive AppData folder using multipart/related
   */
  async createRemoteFile(token) {
    const metadata = {
      name: SYNC_FILENAME,
      parents: ['appDataFolder']
    };
    const payload = this.getLocalPayload();

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(payload) +
      closeDelimiter;

    const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });
    return res.ok;
  }

  async uploadToCloud() {
    if (this.isSyncing) return;
    const token = Auth.getAccessToken();
    if (!token) return;

    this.isSyncing = true;
    try {
      const existingFile = await this.findSyncFile(token);
      if (existingFile) {
        await this.updateRemoteFile(token, existingFile.id);
      } else {
        await this.createRemoteFile(token);
      }
      this.lastSyncedAt = new Date().toISOString();
      Storage.set('last_cloud_sync', this.lastSyncedAt);
      console.log('[CloudSync] Changes uploaded to Google Drive AppData at', this.lastSyncedAt);
    } catch (e) {
      console.error('[CloudSync] Error uploading changes:', e);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const CloudSync = new CloudSyncManager();
