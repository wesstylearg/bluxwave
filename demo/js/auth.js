/**
 * auth.js - Demo authentication mock (No Google Login Required)
 */

class AuthManager {
  constructor() {
    this.session = {
      accessToken: null,
      expiresAt: null,
      user: {
        name: 'Invitado',
        avatar: '',
        channelId: null
      }
    };
    this.listeners = [];
  }

  init() {
    // No-op for demo
  }

  setupTokenClient() {
    // No-op for demo
  }

  getAccessToken() {
    return null;
  }

  getUser() {
    return this.session.user;
  }

  isAuthenticated() {
    return false;
  }

  login() {
    console.log('[Auth] Modo Demo: no se requiere iniciar sesión.');
  }

  logout() {
    console.log('[Auth] Modo Demo: sesión local.');
  }

  async fetchUserProfile() {
    return this.session.user;
  }

  async fetchUserPlaylists() {
    return [];
  }

  async importPlaylist() {
    return null;
  }

  subscribe(fn) {
    this.listeners.push(fn);
    fn(this.session);
  }

  notify(data) {
    this.listeners.forEach(fn => fn(data));
  }
}

export const Auth = new AuthManager();
