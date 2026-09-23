/**
 * auth.js - Google OAuth 2.0 & YouTube Library Sync for BluxWave
 */

import { Config } from './config.js';
import { Storage } from './storage.js';
import { Playlists } from './playlists.js';
import { YouTubeAPI } from './youtube.js';

class AuthManager {
  constructor() {
    this.tokenClient = null;
    this.session = Storage.get('auth') || null; // { accessToken, expiresAt, user: { name, avatar, channelId } }
    this.listeners = [];

    // Verify token expiration
    if (this.session && this.session.expiresAt && Date.now() > this.session.expiresAt) {
      this.session = null;
      Storage.remove('auth');
    }
  }

  init() {
    // Wait for Google Identity Services to load
    const checkGIS = () => {
      if (window.google?.accounts?.oauth2) {
        this.setupTokenClient();
      } else {
        setTimeout(checkGIS, 200);
      }
    };
    checkGIS();
  }

  setupTokenClient() {
    const clientId = Config.getClientId();
    if (!clientId || !window.google?.accounts?.oauth2) return;

    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/youtube.readonly profile email',
        callback: async (response) => {
          if (response.error) {
            console.error('[Auth] OAuth error:', response);
            this.notify({ error: response.error });
            return;
          }

          if (response.access_token) {
            const expiresInMs = (parseInt(response.expires_in, 10) || 3600) * 1000;
            this.session = {
              accessToken: response.access_token,
              expiresAt: Date.now() + expiresInMs,
              user: null
            };

            Storage.set('auth', this.session);

            // Fetch user profile and set default identity
            const user = await this.fetchUserProfile();
            if (user) {
              if (!Config.getUsername() || Config.getUsername() === 'Usuario') {
                Config.setUsername(user.name);
              }
              if (!Config.getAvatar()) {
                Config.setAvatar(user.avatar);
              }
            }
            this.notify({ session: this.session });
          }
        }
      });
      console.log('[Auth] Google Token Client initialized');
    } catch (err) {
      console.error('[Auth] Failed to initialize token client:', err);
    }
  }

  login() {
    if (!this.tokenClient) {
      this.setupTokenClient();
    }

    if (this.tokenClient) {
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      console.error('[Auth] Google Identity Services not loaded yet.');
    }
  }

  logout() {
    if (this.session?.accessToken && window.google?.accounts?.oauth2?.revoke) {
      window.google.accounts.oauth2.revoke(this.session.accessToken, () => {
        console.log('[Auth] Access token revoked');
      });
    }

    this.session = null;
    Storage.remove('auth');
    this.notify({ session: null });
  }

  isAuthenticated() {
    return Boolean(this.session?.accessToken && Date.now() < this.session.expiresAt);
  }

  getUser() {
    return this.session?.user || null;
  }

  getAccessToken() {
    return this.isAuthenticated() ? this.session.accessToken : null;
  }

  async fetchUserProfile() {
    const token = this.getAccessToken();
    if (!token) return null;

    // 1. Try Google OAuth userinfo endpoint (gives official Google Account profile name & photo)
    try {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (userinfoRes.ok) {
        const info = await userinfoRes.json();
        if (info && (info.name || info.picture)) {
          const user = {
            name: info.name || info.email?.split('@')[0] || 'Usuario',
            avatar: info.picture || '',
            email: info.email || ''
          };
          this.session.user = user;
          Storage.set('auth', this.session);
          return user;
        }
      }
    } catch (e) {
      console.warn('[Auth] userinfo fetch failed, falling back to YouTube channel:', e);
    }

    // 2. Fallback to YouTube channel info
    try {
      const res = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Error al obtener perfil de YouTube');

      const data = await res.json();
      const channel = data.items?.[0];

      if (channel) {
        const user = {
          name: channel.snippet?.title || 'Usuario YouTube',
          avatar: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || '',
          channelId: channel.id
        };

        this.session.user = user;
        Storage.set('auth', this.session);
        return user;
      }
    } catch (e) {
      console.error('[Auth] Error fetching YouTube profile:', e);
    }
    return null;
  }

  async fetchUserPlaylists() {
    const token = this.getAccessToken();
    if (!token) throw new Error('No has iniciado sesión con Google.');

    const playlists = [];
    let nextPageToken = '';

    try {
      do {
        const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || 'Error al obtener playlists');
        }

        const data = await res.json();
        (data.items || []).forEach(item => {
          playlists.push({
            id: item.id,
            title: item.snippet?.title || 'Sin título',
            description: item.snippet?.description || '',
            itemCount: item.contentDetails?.itemCount || 0,
            thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ''
          });
        });

        nextPageToken = data.nextPageToken || '';
      } while (nextPageToken);

      return playlists;
    } catch (e) {
      console.error('[Auth] Error fetching playlists:', e);
      throw e;
    }
  }

  async importPlaylist(youtubePlaylistId, customName = null) {
    const token = this.getAccessToken();
    if (!token) throw new Error('No has iniciado sesión con Google.');

    try {
      // 1. Get playlist metadata if customName not provided
      let playlistTitle = customName;
      if (!playlistTitle) {
        const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${youtubePlaylistId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (plRes.ok) {
          const plData = await plRes.json();
          playlistTitle = plData.items?.[0]?.snippet?.title || 'Playlist Importada';
        } else {
          playlistTitle = 'Playlist Importada';
        }
      }

      // 2. Fetch all playlist tracks
      const songs = [];
      let nextPageToken = '';

      do {
        const itemsUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${youtubePlaylistId}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const itemsRes = await fetch(itemsUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!itemsRes.ok) throw new Error('Error al leer canciones de la playlist');

        const itemsData = await itemsRes.json();
        const items = itemsData.items || [];

        // Collect video IDs to fetch duration
        const videoIds = items.map(i => i.contentDetails?.videoId).filter(Boolean).join(',');

        let durationMap = new Map();
        if (videoIds) {
          const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (videosRes.ok) {
            const videosData = await videosRes.json();
            (videosData.items || []).forEach(v => durationMap.set(v.id, v.contentDetails?.duration));
          }
        }

        items.forEach(item => {
          const videoId = item.contentDetails?.videoId;
          if (!videoId) return;

          const isoDur = durationMap.get(videoId);
          const dur = YouTubeAPI.parseDuration(isoDur);

          songs.push({
            id: videoId,
            title: item.snippet?.title || 'Canción',
            artist: YouTubeAPI.cleanArtistName(item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || 'Artista'),
            thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration: dur.formatted,
            durationSec: dur.seconds
          });
        });

        nextPageToken = itemsData.nextPageToken || '';
      } while (nextPageToken && songs.length < 200); // safety cap per import

      // 3. Save into BluxWave Local Playlists
      const newPlaylist = Playlists.create(playlistTitle);
      if (newPlaylist) {
        newPlaylist.songs = songs;
        Playlists.save();
        Playlists.notify();
        return newPlaylist;
      }
    } catch (e) {
      console.error('[Auth] Error importing playlist:', e);
      throw e;
    }
    return null;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.session);
  }

  notify(data) {
    this.listeners.forEach(cb => cb(data));
  }
}

export const Auth = new AuthManager();
