/**
 * ui.js - User Interface Controller & Views Renderer
 */

import { Player } from './player.js';
import { Queue } from './queue.js';
import { Favorites } from './favorites.js';
import { History } from './history.js';
import { Playlists } from './playlists.js';
import { YouTubeAPI, CURATED_TRACKS } from './youtube.js';
import { Config } from './config.js';
import { Auth } from './auth.js';
import { CDCollection } from './collection.js';
import { ColorExtractor } from './color.js';

class UIController {
  constructor() {
    this.currentView = 'home';
    this.isFocusMode = false;
    this.isQueueOpen = false;
    this.isSidebarCollapsed = false;
    this.activePlaylistId = null;
    this.playlistViewMode = 'cds'; // 'cds' (compact jewel cases) or 'list'
    this.searchDebounceTimer = null;
    this.currentDiscoveryTier = 1;
    this.currentDiscoveryGenre = null;
    this.historyDayFilter = 'all';
  }

  init() {
    this.bindEvents();
    this.subscribeToModels();
    this.renderSidebarPlaylists();
    this.renderUserBadge();
    this.showView('home');
    this.updateVolumeSlider(Player.volume);
    this.updateShuffleButtons(Queue.isShuffle);
    this.checkGoogleOnboarding();
  }

  // Format seconds to mm:ss
  formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  cleanArtist(str) {
    if (!str) return 'Artista';
    return String(str)
      .replace(/\s*-\s*(Topic|Tema|Canal Oficial|Official Channel)$/i, '')
      .trim() || str;
  }

  getUserDisplayName() {
    const custom = Config.getUsername();
    if (custom) return custom;
    const user = Auth.getUser();
    if (user && user.name) return user.name;
    return 'Usuario';
  }

  getUserAvatar() {
    const custom = Config.getAvatar();
    if (custom) return custom;
    const user = Auth.getUser();
    if (user && user.avatar) return user.avatar;
    return '';
  }

  getAvatarOrPlaceholder() {
    const av = this.getUserAvatar();
    if (av) return av;
    const initial = (this.getUserDisplayName() || 'U').charAt(0).toUpperCase();
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'><rect width='128' height='128' rx='64' fill='%2322222a'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='-apple-system,BlinkMacSystemFont,sans-serif' font-weight='600' font-size='52' fill='%23e4e4e7'>${initial}</text></svg>`;
  }

  getUserBio() {
    return Config.getBio() || 'Melómano en BluxWave.';
  }

  checkGoogleOnboarding() {
    // Si ya está autenticado, no mostrar nada
    if (Auth.isAuthenticated()) return;

    // Verificar si ya se mostró / descartó anteriormente
    const done = Config.get('google_onboarding_done');
    if (done) return;

    // Mostrar modal con un pequeño retraso tras la carga inicial
    setTimeout(() => {
      if (!Auth.isAuthenticated()) {
        this.openGoogleOnboardingModal();
      }
    }, 800);
  }

  openGoogleOnboardingModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    if (!modalBackdrop || !modalContent) return;

    modalContent.innerHTML = `
      <div style="text-align: center; padding: 16px 8px 10px 8px;">
        <div style="width: 58px; height: 58px; margin: 0 auto 16px; border-radius: 50%; background: rgba(99, 102, 241, 0.12); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(99, 102, 241, 0.25);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
        </div>
        <h2 class="modal-title" style="margin-bottom: 8px; font-size: 20px;">¡Bienvenido a BluxWave!</h2>
        <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.55; margin-bottom: 24px; max-width: 380px; margin-left: auto; margin-right: auto;">
          Inicia sesión con tu cuenta de Google para respaldar tus carpetas, guardar tu colección de discos y sincronizar tu música en cualquier dispositivo automáticamente.
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button class="btn btn-primary" id="onboarding-login-google-btn" style="padding: 12px 20px; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 10px; font-weight: 600;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Entrar con Google
          </button>
          <button class="btn btn-secondary" id="onboarding-dismiss-btn" style="padding: 10px 16px; font-size: 13px; color: var(--text-muted);">
            Continuar como invitado
          </button>
        </div>
      </div>
    `;

    modalBackdrop.classList.add('open');

    document.getElementById('onboarding-login-google-btn')?.addEventListener('click', () => {
      Config.set('google_onboarding_done', true);
      this.closeModal();
      Auth.login();
    });

    document.getElementById('onboarding-dismiss-btn')?.addEventListener('click', () => {
      Config.set('google_onboarding_done', true);
      this.closeModal();
    });
  }

  getUserMusicStats() {
    const history = History.getAll();
    const playlists = Playlists.getAll();
    const collection = CDCollection.getAll();

    const artistCounts = {};
    const songCounts = {};
    let totalSecs = 0;

    history.forEach(t => {
      const art = this.cleanArtist(t.artist || 'Artista');
      artistCounts[art] = (artistCounts[art] || 0) + 1;
      songCounts[t.title] = { count: (songCounts[t.title]?.count || 0) + 1, artist: art, track: t };
      totalSecs += t.durationSec || 210;
    });

    let topArtist = 'Sin datos';
    let maxArtCount = 0;
    for (const [art, count] of Object.entries(artistCounts)) {
      if (count > maxArtCount) {
        maxArtCount = count;
        topArtist = art;
      }
    }

    let topSong = 'Sin canciones';
    let maxSongCount = 0;
    for (const [title, data] of Object.entries(songCounts)) {
      if (data.count > maxSongCount) {
        maxSongCount = data.count;
        topSong = title;
      }
    }

    const songsCount = history.length;
    const artistsCount = Object.keys(artistCounts).length;
    const albumsCount = playlists.length + collection.length;

    let listenedTime = '0m';
    if (history.length > 0) {
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      listenedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    let albumOfWeek = 'Sin álbumes';
    if (collection.length > 0) {
      albumOfWeek = collection[0].title;
    } else if (playlists.length > 0) {
      albumOfWeek = playlists[0].name;
    }

    let predominantGenre = 'Por descubrir';
    if (collection.length > 0 && collection[0].genre) {
      predominantGenre = collection[0].genre;
    } else if (history.length > 0) {
      predominantGenre = 'Variado';
    }

    return {
      songsCount,
      artistsCount,
      albumsCount,
      listenedTime,
      topArtist,
      topSong,
      albumOfWeek,
      predominantGenre
    };
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, 2400);
  }

  handleEscapeKey() {
    const ctxMenu = document.getElementById('context-menu');
    if (ctxMenu && ctxMenu.classList.contains('open')) {
      this.closeContextMenu();
      return;
    }
    if (this.isFocusMode) {
      this.toggleFocusMode(false);
      return;
    }
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop && modalBackdrop.classList.contains('open')) {
      this.closeModal();
      return;
    }
    if (this.isQueueOpen) {
      this.toggleQueue(false);
      return;
    }
  }

  subscribeToModels() {
    // Player Events
    Player.on('stateChange', ({ isPlaying }) => {
      this.updatePlayPauseIcons(isPlaying);
    });

    Player.on('trackChange', (track) => {
      this.updateTrackInfo(track);
    });

    Player.on('timeUpdate', ({ currentTime, duration, progress }) => {
      this.updateProgress(currentTime, duration, progress);
    });

    Player.on('error', (code) => {
      if (code === 150 || code === 101) {
        if (Player.currentTrack?.id) {
          YouTubeAPI.markRestricted(Player.currentTrack.id);
        }
        Queue.next();
      } else {
        this.showToast('Error de reproducción en el contenido.');
      }
    });

    // Queue Events
    Queue.subscribe((queueData) => {
      this.renderQueuePanel(queueData);
      this.updateShuffleButtons(queueData?.isShuffle);
      this.highlightActiveRow();
    });

    // Favorites Events
    Favorites.subscribe(() => {
      this.updateFavoriteButton();
      if (this.currentView === 'library' || this.currentView === 'home' || this.currentView === 'profile') {
        this.renderView(this.currentView);
      }
    });

    // Playlists Events
    Playlists.subscribe(() => {
      this.renderSidebarPlaylists();
      if (this.currentView === 'library' || this.currentView === 'home') {
        this.renderView(this.currentView);
      } else if (this.currentView === 'playlist' && this.activePlaylistId) {
        this.renderPlaylistView(this.activePlaylistId);
      }
    });

    // History Events
    History.subscribe(() => {
      if (this.currentView === 'history' || this.currentView === 'home') {
        this.renderView(this.currentView);
      }
    });

    // Auth Events
    Auth.subscribe((data) => {
      this.renderUserBadge();
      if (data?.error) {
        this.showToast('Error de autenticación con Google.');
      } else if (data?.session?.user) {
        this.showToast(`Conectado como ${data.session.user.name}`);
      }
      if (this.currentView === 'settings' || this.currentView === 'library') {
        this.renderView(this.currentView);
      }
    });

    // CD Collection Events
    CDCollection.subscribe(() => {
      this.updateFavoriteButton();
      if (this.currentView === 'library') {
        this.renderLibraryView();
      }
      if (this.currentView === 'profile') {
        this.renderProfileView();
      }
    });
  }

  bindEvents() {
    // Navigation Items
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = item.dataset.nav;
        this.showView(view);
      });
    });

    // Search Input
    const searchInput = document.getElementById('global-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          if (val.length > 0) {
            this.showView('search');
            this.performSearch(val);
          }
        }, 350);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = searchInput.value.trim();
          if (val.length > 0) {
            clearTimeout(this.searchDebounceTimer);
            this.showView('search');
            this.performSearch(val);
          }
        }
      });
    }

    // Mini Player Controls
    const playBtn = document.getElementById('player-play-btn');
    if (playBtn) playBtn.addEventListener('click', () => Player.togglePlay());

    const nextBtn = document.getElementById('player-next-btn');
    if (nextBtn) nextBtn.addEventListener('click', () => Queue.next());

    const prevBtn = document.getElementById('player-prev-btn');
    if (prevBtn) prevBtn.addEventListener('click', () => Queue.prev());

    const shuffleBtn = document.getElementById('player-shuffle-btn');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', () => {
        const isShuffle = Queue.toggleShuffle();
        this.updateShuffleButtons(isShuffle);
        this.showToast(isShuffle ? 'Reproducción aleatoria activada' : 'Reproducción secuencial');
      });
    }

    const favBtn = document.getElementById('player-fav-btn');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        const track = Player.currentTrack;
        if (track) {
          const kept = CDCollection.toggleCD(track, 'collection');
          this.showToast(kept ? '¡Te quedaste el CD! Guardado en tu colección' : 'CD retirado de tu colección');
          this.updateFavoriteButton();
        }
      });
    }

    // Artist quick chusmear click on mini player
    const playerArtist = document.getElementById('player-artist');
    if (playerArtist) {
      playerArtist.style.cursor = 'pointer';
      playerArtist.addEventListener('click', () => {
        if (Player.currentTrack?.artist) {
          this.renderArtistView(Player.currentTrack.artist, Player.currentTrack.channelId);
        }
      });
    }

    // Progress Bar Scrubber
    const progressBar = document.getElementById('player-progress-input');
    if (progressBar) {
      progressBar.addEventListener('input', (e) => {
        const pct = parseFloat(e.target.value);
        if (Player.duration > 0) {
          const seekTo = (pct / 100) * Player.duration;
          Player.seekTo(seekTo);
        }
      });
    }

    // Volume Slider
    const volumeSlider = document.getElementById('volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value, 10);
        Player.setVolume(vol);
        this.updateVolumeSlider(vol);
      });
    }

    // Queue Panel Toggle
    const queueBtn = document.getElementById('queue-toggle-btn');
    if (queueBtn) queueBtn.addEventListener('click', () => this.toggleQueue());

    const queueCloseBtn = document.getElementById('queue-close-btn');
    if (queueCloseBtn) queueCloseBtn.addEventListener('click', () => this.toggleQueue(false));

    const queueClearBtn = document.getElementById('queue-clear-btn');
    if (queueClearBtn) {
      queueClearBtn.addEventListener('click', () => {
        Queue.clear();
        this.showToast('Cola vaciada');
      });
    }

    // Focus Mode
    const focusBtn = document.getElementById('focus-toggle-btn');
    if (focusBtn) focusBtn.addEventListener('click', () => this.toggleFocusMode(true));

    const focusCloseBtn = document.getElementById('focus-close-btn');
    if (focusCloseBtn) focusCloseBtn.addEventListener('click', () => this.toggleFocusMode(false));
    const focusBackBtn = document.getElementById('focus-back-btn');
    if (focusBackBtn) focusBackBtn.addEventListener('click', () => this.toggleFocusMode(false));
    const focusFsBtn = document.getElementById('focus-fullscreen-btn');
    if (focusFsBtn) {
      focusFsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    const playerCover = document.getElementById('player-cover-container');
    const trackInfo = document.querySelector('.player-track-info');
    if (trackInfo) {
      trackInfo.addEventListener('click', (e) => {
        if (e.target.closest('#player-fav-btn')) return;
        this.openFocusMode();
      });
    }
    if (playerCover) playerCover.addEventListener('click', () => this.toggleFocusMode(true));

    const playerTitle = document.getElementById('player-title');
    if (playerTitle) playerTitle.addEventListener('click', () => this.toggleFocusMode(true));

    // Focus Mode Controls
    const focusPlayBtn = document.getElementById('focus-play-btn');
    if (focusPlayBtn) focusPlayBtn.addEventListener('click', () => Player.togglePlay());

    const focusNextBtn = document.getElementById('focus-next-btn');
    if (focusNextBtn) focusNextBtn.addEventListener('click', () => Queue.next());

    const focusPrevBtn = document.getElementById('focus-prev-btn');
    if (focusPrevBtn) focusPrevBtn.addEventListener('click', () => Queue.prev());

    const focusShuffleBtn = document.getElementById('focus-shuffle-btn');
    if (focusShuffleBtn) {
      focusShuffleBtn.addEventListener('click', () => {
        const isShuffle = Queue.toggleShuffle();
        this.updateShuffleButtons(isShuffle);
        this.showToast(isShuffle ? 'Reproducción aleatoria activada' : 'Reproducción secuencial');
      });
    }

    const focusArtist = document.getElementById('focus-artist');
    if (focusArtist) {
      focusArtist.style.cursor = 'pointer';
      focusArtist.addEventListener('click', () => {
        if (Player.currentTrack?.artist) {
          this.toggleFocusMode(false);
          this.renderArtistView(Player.currentTrack.artist, Player.currentTrack.channelId);
        }
      });
    }

    const focusFavBtn = document.getElementById('focus-fav-btn');
    if (focusFavBtn) {
      focusFavBtn.addEventListener('click', () => {
        const track = Player.currentTrack;
        if (track) {
          const kept = CDCollection.toggleCD(track, 'collection');
          this.showToast(kept ? '¡Te quedaste el CD! Guardado en tu colección' : 'CD retirado de tu colección');
          this.updateFavoriteButton();
        }
      });
    }

    const focusProgress = document.getElementById('focus-progress-input');
    if (focusProgress) {
      focusProgress.addEventListener('input', (e) => {
        const pct = parseFloat(e.target.value);
        if (Player.duration > 0) {
          Player.seekTo((pct / 100) * Player.duration);
        }
      });
    }

    // Sidebar Collapse Toggle
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        const container = document.getElementById('app-container');
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        container.classList.toggle('sidebar-collapsed', this.isSidebarCollapsed);
      });
    }

    // New Playlist Modal Buttons
    const newPlaylistBtn = document.getElementById('sidebar-new-playlist-btn');
    if (newPlaylistBtn) {
      newPlaylistBtn.addEventListener('click', () => this.openCreatePlaylistModal());
    }

    // Topbar Playlists Popover Toggle
    const navPlaylistsBtn = document.getElementById('nav-playlists-btn');
    const playlistsPopover = document.getElementById('topbar-playlists-popover');
    if (navPlaylistsBtn && playlistsPopover) {
      navPlaylistsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playlistsPopover.classList.toggle('open');
      });
    }

    const popoverNewPlBtn = document.getElementById('popover-new-playlist-btn');
    if (popoverNewPlBtn) {
      popoverNewPlBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (playlistsPopover) playlistsPopover.classList.remove('open');
        this.openCreatePlaylistModal();
      });
    }

    document.addEventListener('click', (e) => {
      if (playlistsPopover && playlistsPopover.classList.contains('open') && !playlistsPopover.contains(e.target) && e.target !== navPlaylistsBtn) {
        playlistsPopover.classList.remove('open');
      }
    });

    // Topbar User Menu Popover Toggle & Actions
    const userBadgeBtn = document.getElementById('topbar-user-badge');
    const userMenuPopover = document.getElementById('topbar-user-menu-popover');
    if (userBadgeBtn && userMenuPopover) {
      userBadgeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (playlistsPopover) playlistsPopover.classList.remove('open');
        userMenuPopover.classList.toggle('open');
      });
    }

    document.getElementById('menu-nav-profile-btn')?.addEventListener('click', () => {
      if (userMenuPopover) userMenuPopover.classList.remove('open');
      this.showView('profile');
    });

    document.getElementById('menu-share-profile-btn')?.addEventListener('click', () => {
      if (userMenuPopover) userMenuPopover.classList.remove('open');
      this.openShareCardModal(this.getUserMusicStats());
    });

    document.getElementById('menu-nav-settings-btn')?.addEventListener('click', () => {
      if (userMenuPopover) userMenuPopover.classList.remove('open');
      this.showView('settings');
    });

    document.addEventListener('click', (e) => {
      if (userMenuPopover && userMenuPopover.classList.contains('open') && !userMenuPopover.contains(e.target) && e.target !== userBadgeBtn) {
        userMenuPopover.classList.remove('open');
      }
    });

    // Official Video Dock Toggle
    const videoToggleBtn = document.getElementById('video-toggle-btn');
    const ytVideoDock = document.getElementById('yt-video-dock');
    const ytDockCloseBtn = document.getElementById('yt-dock-close-btn');

    if (videoToggleBtn && ytVideoDock) {
      videoToggleBtn.addEventListener('click', () => {
        ytVideoDock.classList.toggle('minimized');
      });
    }

    if (ytDockCloseBtn && ytVideoDock) {
      ytDockCloseBtn.addEventListener('click', () => {
        ytVideoDock.classList.add('minimized');
      });
    }

    // Global Context Menu listener for ANY song / track / CD / queue element
    document.addEventListener('contextmenu', (e) => {
      const trackElem = e.target.closest('[data-track], [data-track-id], [data-cd-id], .shelf-cd-item, .song-card, .compact-cd-card, .song-row, .queue-item, .user-queue-item, .context-queue-item');
      if (trackElem) {
        let track = null;
        if (trackElem.dataset.track) {
          try {
            track = JSON.parse(trackElem.dataset.track);
          } catch (err) {}
        }
        if (!track && trackElem.dataset.cdId) {
          const cd = CDCollection.getById(trackElem.dataset.cdId);
          if (cd) {
            track = {
              id: cd.id,
              title: cd.trackTitle || cd.title,
              artist: cd.artist,
              thumbnail: cd.thumbnail,
              duration: cd.duration
            };
          }
        }
        if (!track && trackElem.dataset.trackId) {
          const trackId = trackElem.dataset.trackId;
          const cd = CDCollection.getById(trackId);
          if (cd) {
            track = {
              id: cd.id,
              title: cd.trackTitle || cd.title,
              artist: cd.artist,
              thumbnail: cd.thumbnail,
              duration: cd.duration
            };
          } else if (Player.currentTrack && String(Player.currentTrack.id) === String(trackId)) {
            track = Player.currentTrack;
          }
        }
        if (!track && trackElem.classList.contains('user-queue-item')) {
          const idx = parseInt(trackElem.dataset.userIdx, 10);
          const uQueue = Queue.getUserQueue ? Queue.getUserQueue() : [];
          if (!isNaN(idx) && uQueue[idx]) {
            track = uQueue[idx];
          }
        }
        if (track) {
          e.preventDefault();
          e.stopPropagation();
          const playlistId = trackElem.dataset.playlistId || this.activePlaylistId || null;
          this.showContextMenu(e, track, playlistId);
        }
      }
    });

    // Global Context Menu dismiss
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#context-menu')) {
        this.closeContextMenu();
      }
    });

    window.addEventListener('scroll', () => {
      this.closeContextMenu();
    }, true);

    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.closeModal();
      });
    }
  }

  showView(viewName) {
    this.currentView = viewName;

    // Update active state in nav
    document.querySelectorAll('[data-nav]').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === viewName);
    });

    // Hide all view containers
    document.querySelectorAll('.view-container').forEach(c => {
      c.classList.remove('active', 'view-animate-in');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active', 'view-animate-in');
      this.renderView(viewName);
    }
  }

  renderView(viewName) {
    switch (viewName) {
      case 'home':
        this.renderHomeView();
        break;
      case 'library':
        this.renderLibraryView();
        break;
      case 'history':
        this.renderHistoryView();
        break;
      case 'settings':
        this.renderSettingsView();
        break;
      case 'profile':
        this.renderProfileView();
        break;
      default:
        break;
    }
  }

  renderHomeView() {
    const container = document.getElementById('view-home');
    if (!container) return;

    const history = History.getAll();
    const playlists = Playlists.getAll();

    let html = `
      <div class="view-header" style="display: flex; align-items: center; gap: 14px; margin-bottom: 28px;">
        <img src="./assets/logo.png" alt="BluxWave" style="width: 44px; height: 44px; border-radius: 12px; box-shadow: 0 4px 18px rgba(0,0,0,0.5);">
        <div>
          <h1 class="view-title" style="margin-bottom: 2px; font-size: 24px; letter-spacing: -0.5px;">BluxWave</h1>
          <p class="view-subtitle" style="font-size: 13px;">Tu música, limpia y directa</p>
        </div>
      </div>
    `;

    // 1. Continuar escuchando (escuchados recientemente)
    html += `
      <div style="margin-bottom: 36px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 18px; font-weight: 600;">Continuar escuchando</h2>
          ${history.length > 6 ? `<button class="btn btn-secondary" id="home-view-all-history" style="font-size: 12px; padding: 5px 12px;">Ver historial completo</button>` : ''}
        </div>
        ${history.length === 0 ? `
          <div style="padding: 24px 0; color: var(--text-muted); font-size: 13.5px;">
            Aún no has reproducido canciones. Las canciones que escuches aparecerán aquí.
          </div>
        ` : `
          <div class="card-grid">
            ${history.slice(0, 8).map(track => this.renderSongCardHTML(track)).join('')}
          </div>
        `}
      </div>
    `;

    // 2. Tus libretas (playlists)
    html += `
      <div style="margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 2px;">Tus libretas</h2>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0;">Tus listas y selecciones organizadas.</p>
          </div>
          <button class="btn btn-secondary" id="home-create-pl-btn" style="font-size: 12px; padding: 6px 14px;">+ Nueva libreta</button>
        </div>
        ${playlists.length === 0 ? `
          <div style="padding: 24px 0; color: var(--text-muted); font-size: 13.5px;">
            No tienes libretas aún. Pulsa en "+ Nueva libreta" para armar tu primera lista.
          </div>
        ` : `
          <div class="playlist-card-grid card-grid">
            ${playlists.map(pl => this.renderPlaylistCardHTML(pl)).join('')}
          </div>
        `}
      </div>
    `;

    container.innerHTML = html;
    this.attachCardEventListeners(container);

    document.getElementById('home-create-pl-btn')?.addEventListener('click', () => this.openCreatePlaylistModal());
    document.getElementById('home-view-all-history')?.addEventListener('click', () => this.showView('history'));
  }

  renderLibraryView() {
    const container = document.getElementById('view-library');
    if (!container) return;

    const collectedCDs = CDCollection.getAll();
    const playlists = Playlists.getAll();

    let html = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
        <div>
          <h1 class="view-title" style="margin-bottom: 4px;">Biblioteca</h1>
          <p class="view-subtitle" style="margin-bottom: 0;">Colección de CDs y carpetas organizadas.</p>
        </div>
        ${collectedCDs.length > 0 ? `
          <button class="btn btn-primary" id="play-all-collection-btn" style="display: flex; align-items: center; gap: 8px; padding: 9px 18px; font-size: 13px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Reproducir Colección
          </button>
        ` : ''}
      </div>

      <!-- 1. COLECCIÓN DE CDS APILADOS (FAVORITOS) -->
      <div class="cd-shelf-container" style="margin-bottom: 44px;">
        <div class="cd-shelf-header">
          <div>
            <div class="cd-shelf-title">Colección de CDs</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Canciones y álbumes agregados a favoritos</div>
          </div>
          <span class="cd-shelf-count-badge">${collectedCDs.length} CDs</span>
        </div>

        ${collectedCDs.length === 0 ? `
          <div style="padding: 48px 24px; text-align: center; color: var(--text-muted); font-size: 13.5px; background: rgba(255, 255, 255, 0.02); border-radius: 12px; border: 1px dashed var(--border-subtle); margin-top: 14px;">
            Tu estantería de CDs está vacía. Añade temas a favoritos con el corazón para coleccionar sus cajas físicas de CD.
          </div>
        ` : `
          <div class="cd-shelf-stage">
            <div class="cd-shelf-grid">
              ${collectedCDs.slice(0, 36).map(cd => this.renderShelfCDItemHTML(cd)).join('')}
            </div>
          </div>
        `}
      </div>

      <!-- 2. CARPETAS (PLAYLISTS MANUALES) -->
      <div style="margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 2px;">Carpetas (${playlists.length})</h2>
            <p style="font-size: 12.5px; color: var(--text-muted); margin: 0;">Tus listas de reproducción manuales.</p>
          </div>
          <div style="display: flex; gap: 8px;">
            ${Auth.isAuthenticated() ? `
              <button class="btn btn-secondary" id="lib-import-yt-btn" style="font-size: 12px; padding: 6px 12px; display: flex; align-items: center; gap: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Importar Carpetas de YouTube
              </button>
            ` : ''}
            <button class="btn btn-secondary" id="lib-create-pl-btn" style="font-size: 12px; padding: 6px 12px; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Nueva Carpeta
            </button>
          </div>
        </div>
        ${playlists.length === 0 ? `
          <div style="padding: 32px 0; color: var(--text-muted); font-size: 13.5px;">
            Aún no has creado carpetas. Pulsa en "+ Nueva Carpeta" para empezar a organizar tu música.
          </div>
        ` : `
          <div class="playlist-card-grid card-grid">
            ${playlists.map(pl => this.renderPlaylistCardHTML(pl)).join('')}
          </div>
        `}
      </div>
    `;

    container.innerHTML = html;
    this.attachCardEventListeners(container);
    this.attachShelfEventListeners(container, collectedCDs);

    const playAllBtn = document.getElementById('play-all-collection-btn');
    if (playAllBtn) {
      playAllBtn.addEventListener('click', () => {
        const playable = collectedCDs.map(cd => ({
          id: cd.id,
          title: cd.trackTitle || cd.title,
          artist: cd.artist,
          thumbnail: cd.thumbnail,
          duration: cd.duration
        }));
        Queue.setQueue(playable, 0);
      });
    }

    const libCreateBtn = document.getElementById('lib-create-pl-btn');
    if (libCreateBtn) libCreateBtn.addEventListener('click', () => this.openCreatePlaylistModal());

    const libImportYtBtn = document.getElementById('lib-import-yt-btn');
    if (libImportYtBtn) libImportYtBtn.addEventListener('click', () => this.openImportYouTubePlaylistsModal());
  }

  renderHistoryView() {
    const container = document.getElementById('view-history');
    if (!container) return;

    const history = History.getAll();
    const filter = this.historyDayFilter || 'all';

    let html = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
        <div>
          <h1 class="view-title" style="margin-bottom: 4px;">Historial de Reproducción</h1>
          <p class="view-subtitle" style="margin-bottom: 0;">Temas escuchados, filtrados por día.</p>
        </div>
        ${history.length > 0 ? `<button class="btn btn-secondary" id="clear-history-btn" style="font-size: 12px; padding: 6px 14px;">Limpiar historial</button>` : ''}
      </div>
    `;

    if (history.length === 0) {
      html += `<div style="padding: 40px 0; color: var(--text-muted); font-size: 13.5px;">No hay canciones en el historial todavía.</div>`;
    } else {
      // Calculate day groups and counts
      const now = new Date();
      const todayStr = now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toDateString();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      let countToday = 0, countYesterday = 0, countWeek = 0, countOlder = 0;
      history.forEach(t => {
        const d = t.playedAt ? new Date(t.playedAt) : new Date();
        const dStr = d.toDateString();
        if (dStr === todayStr) countToday++;
        else if (dStr === yesterdayStr) countYesterday++;
        else if (d >= startOfWeek) countWeek++;
        else countOlder++;
      });

      // Filter tabs
      html += `
        <div class="history-day-filters">
          <button class="history-day-chip ${filter === 'all' ? 'active' : ''}" data-history-filter="all">
            Todos (${history.length})
          </button>
          ${countToday > 0 ? `
            <button class="history-day-chip ${filter === 'today' ? 'active' : ''}" data-history-filter="today">
              Hoy (${countToday})
            </button>
          ` : ''}
          ${countYesterday > 0 ? `
            <button class="history-day-chip ${filter === 'yesterday' ? 'active' : ''}" data-history-filter="yesterday">
              Ayer (${countYesterday})
            </button>
          ` : ''}
          ${countWeek > 0 ? `
            <button class="history-day-chip ${filter === 'week' ? 'active' : ''}" data-history-filter="week">
              Esta semana (${countToday + countYesterday + countWeek})
            </button>
          ` : ''}
          ${countOlder > 0 ? `
            <button class="history-day-chip ${filter === 'older' ? 'active' : ''}" data-history-filter="older">
              Días anteriores (${countOlder})
            </button>
          ` : ''}
        </div>
      `;

      // Group tracks
      const groups = [];
      const groupsMap = new Map();

      history.forEach((track, globalIdx) => {
        const d = track.playedAt ? new Date(track.playedAt) : new Date();
        const dStr = d.toDateString();
        let groupKey = '';
        let groupTitle = '';
        let groupCategory = 'older';

        if (dStr === todayStr) {
          groupKey = 'today';
          groupTitle = 'Hoy';
          groupCategory = 'today';
        } else if (dStr === yesterdayStr) {
          groupKey = 'yesterday';
          groupTitle = 'Ayer';
          groupCategory = 'yesterday';
        } else if (d >= startOfWeek) {
          groupKey = dStr;
          const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' });
          const dayNum = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          groupTitle = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} (${dayNum})`;
          groupCategory = 'week';
        } else {
          groupKey = dStr;
          groupTitle = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
          groupCategory = 'older';
        }

        // Apply filter
        let include = true;
        if (filter === 'today' && groupCategory !== 'today') include = false;
        if (filter === 'yesterday' && groupCategory !== 'yesterday') include = false;
        if (filter === 'week' && groupCategory !== 'week' && groupCategory !== 'today' && groupCategory !== 'yesterday') include = false;
        if (filter === 'older' && groupCategory !== 'older') include = false;

        if (include) {
          if (!groupsMap.has(groupKey)) {
            const grp = { key: groupKey, title: groupTitle, tracks: [] };
            groupsMap.set(groupKey, grp);
            groups.push(grp);
          }
          groupsMap.get(groupKey).tracks.push({ track, globalIdx });
        }
      });

      if (groups.length === 0) {
        html += `<div style="padding: 32px 0; color: var(--text-muted); font-size: 13px;">No se encontraron reproducciones para este filtro de día.</div>`;
      } else {
        groups.forEach(grp => {
          html += `
            <div class="history-group-header">
              <span>${this.escapeHTML(grp.title)}</span>
              <span style="font-size: 11.5px; font-weight: normal; color: var(--text-muted);">${grp.tracks.length} tema${grp.tracks.length === 1 ? '' : 's'}</span>
            </div>
            <div class="song-list" style="margin-bottom: 24px;">
              ${grp.tracks.map(({ track, globalIdx }) => this.renderSongRowHTML(track, globalIdx)).join('')}
            </div>
          `;
        });
      }
    }

    container.innerHTML = html;
    this.attachCardEventListeners(container);

    // Filter chip clicks
    container.querySelectorAll('.history-day-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.historyDayFilter = chip.dataset.historyFilter;
        this.renderHistoryView();
      });
    });

    const clearBtn = document.getElementById('clear-history-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('¿Vaciar todo el historial de reproducción?')) {
          History.clear();
          this.renderHistoryView();
        }
      });
    }
  }

  renderPlaylistView(playlistId) {
    this.activePlaylistId = playlistId;
    const playlist = Playlists.getById(playlistId);
    if (!playlist) {
      this.showView('library');
      return;
    }

    const container = document.getElementById('view-playlist');
    if (!container) return;

    const cover = Playlists.getCover(playlist);

    let html = `
      <div style="margin-bottom: 24px;">
        <button class="icon-btn" id="back-to-lib-btn" style="margin-bottom: 16px; width: 34px; height: 34px;" title="Volver a Biblioteca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div style="display: flex; gap: 24px; align-items: flex-end; flex-wrap: wrap;">
          <div style="position: relative; width: 140px; height: 140px; border-radius: var(--radius-md); overflow: hidden; background: #18181b; flex-shrink: 0; box-shadow: 0 10px 30px rgba(0,0,0,0.5); cursor: pointer;" id="pl-cover-trigger" title="Cambiar portada de la carpeta">
            ${cover ? `<img src="${cover}" style="width: 100%; height: 100%; object-fit: cover;" alt="${playlist.name}">` : `
              <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#71717A" stroke-width="1.5">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              </div>
            `}
            <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); opacity: 0; transition: opacity 150ms ease; display: flex; align-items: center; justify-content: center; font-size: 11px; text-align: center; padding: 6px; color: #FFFFFF;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">
              Cambiar imagen
            </div>
          </div>
          <div style="flex: 1; min-width: 220px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
                Libreta
              </div>
            <h1 class="view-title" style="margin-bottom: 6px;">${playlist.name}</h1>
            <p class="view-subtitle">${playlist.songs.length} pistas • ${this.escapeHTML(this.getUserDisplayName())}</p>
            <div style="display: flex; gap: 10px; margin-top: 18px; align-items: center; flex-wrap: wrap;">
              ${playlist.songs.length > 0 ? `
                <button class="action-icon-fab" id="play-pl-btn" title="Reproducir carpeta">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              ` : ''}

              <label class="action-icon-btn" title="Subir portada desde el ordenador" style="cursor: pointer; margin: 0;">
                <input type="file" id="direct-pl-cover-upload" accept="image/*" style="display:none;">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </label>

              <button class="action-icon-btn" id="edit-pl-btn" title="Editar carpeta">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </button>

              <button class="action-icon-btn danger" id="delete-pl-btn" title="Eliminar carpeta">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>

              <!-- View mode toggle: Compact CDs vs List -->
              <div class="view-mode-toggle" style="margin-left: auto;">
                <button class="view-mode-btn ${this.playlistViewMode === 'cds' ? 'active' : ''}" id="pl-mode-cds-btn" title="Vista CDs compactos">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                </button>
                <button class="view-mode-btn ${this.playlistViewMode === 'list' ? 'active' : ''}" id="pl-mode-list-btn" title="Vista Lista">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <circle cx="4" cy="6" r="1.5" fill="currentColor"></circle>
                    <circle cx="4" cy="12" r="1.5" fill="currentColor"></circle>
                    <circle cx="4" cy="18" r="1.5" fill="currentColor"></circle>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    if (playlist.songs.length === 0) {
      html += `<div style="padding: 40px 0; color: var(--text-muted);">Esta carpeta está vacía. Busca canciones y pulsa en "Añadir a una carpeta".</div>`;
    } else if (this.playlistViewMode === 'cds') {
      const initialChunk = playlist.songs.slice(0, 36);
      html += `
        <div class="cd-shelf-container" style="margin-top: 10px;">
          <div class="cd-shelf-stage">
            <div class="cd-shelf-grid">
              ${initialChunk.map(track => this.renderShelfCDItemHTML(track, playlistId)).join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="song-list" style="margin-top: 10px;">
          ${playlist.songs.map((track, idx) => this.renderSongRowHTML(track, idx, playlistId)).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
    this.showView('playlist');
    this.attachCardEventListeners(container, playlist.songs);
    if (this.playlistViewMode === 'cds') {
      this.attachShelfEventListeners(container, playlist.songs, playlistId);
    }

    const backBtn = document.getElementById('back-to-lib-btn');
    if (backBtn) backBtn.addEventListener('click', () => this.showView('library'));

    const playBtn = document.getElementById('play-pl-btn');
    if (playBtn) playBtn.addEventListener('click', () => Playlists.play(playlistId, 0));

    const editBtn = document.getElementById('edit-pl-btn');
    if (editBtn) editBtn.addEventListener('click', () => this.openEditPlaylistModal(playlistId));

    const coverTrigger = document.getElementById('pl-cover-trigger');
    if (coverTrigger) coverTrigger.addEventListener('click', () => this.openEditPlaylistModal(playlistId));

    // Direct image upload from PC
    const directUpload = document.getElementById('direct-pl-cover-upload');
    if (directUpload) {
      directUpload.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            this.showToast('La imagen es demasiado pesada (máx 5MB)');
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            const base64 = ev.target.result;
            Playlists.update(playlistId, { cover: base64 });
            this.showToast('Portada actualizada desde tu ordenador');
            this.renderPlaylistView(playlistId);
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // View mode toggle buttons
    document.getElementById('pl-mode-cds-btn')?.addEventListener('click', () => {
      this.playlistViewMode = 'cds';
      this.renderPlaylistView(playlistId);
    });

    document.getElementById('pl-mode-list-btn')?.addEventListener('click', () => {
      this.playlistViewMode = 'list';
      this.renderPlaylistView(playlistId);
    });

    const delBtn = document.getElementById('delete-pl-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (confirm(`¿Eliminar la carpeta "${playlist.name}"?`)) {
          Playlists.delete(playlistId);
          this.showToast('Carpeta eliminada');
          this.showView('library');
        }
      });
    }
  }

  openEditPlaylistModal(playlistId) {
    const playlist = Playlists.getById(playlistId);
    if (!playlist) return;

    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    if (!modalBackdrop || !modalContent) return;

    const currentCover = playlist.cover || '';
    const firstSongThumb = playlist.songs?.[0]?.thumbnail || '';

    modalContent.innerHTML = `
      <h2 class="modal-title">Editar Carpeta</h2>
      <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
        <div>
          <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 6px;">Nombre de la carpeta</label>
          <input type="text" id="edit-pl-name-input" class="modal-input" style="margin-bottom: 0;" value="${playlist.name.replace(/"/g, '&quot;')}">
        </div>
        <div>
          <label style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 6px;">Portada de la carpeta</label>
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="text" id="edit-pl-cover-input" class="modal-input" style="margin-bottom: 0; flex: 1;" placeholder="URL o sube un archivo..." value="${currentCover.startsWith('data:') ? 'Imagen guardada localmente' : currentCover}">
            <label class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; margin: 0;" title="Elegir imagen de tu PC">
              <input type="file" id="modal-pl-file-input" accept="image/*" style="display: none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              Subir PC
            </label>
          </div>
          ${firstSongThumb ? `
            <button class="btn btn-secondary" id="use-first-thumb-btn" style="font-size: 11px; padding: 4px 10px;">
              Usar portada de la 1ª canción
            </button>
          ` : ''}
        </div>
        <div id="edit-pl-preview-wrapper" style="display: flex; align-items: center; gap: 12px; padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <img id="edit-pl-preview-img" src="${currentCover || firstSongThumb || 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg'}" style="width: 50px; height: 50px; border-radius: 4px; object-fit: cover;">
          <div style="font-size: 12px; color: var(--text-secondary);">Vista previa de la portada</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="edit-pl-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="edit-pl-save-btn">Guardar cambios</button>
      </div>
    `;

    modalBackdrop.classList.add('open');

    const nameInput = document.getElementById('edit-pl-name-input');
    const coverInput = document.getElementById('edit-pl-cover-input');
    const previewImg = document.getElementById('edit-pl-preview-img');
    const useThumbBtn = document.getElementById('use-first-thumb-btn');
    const fileInput = document.getElementById('modal-pl-file-input');

    let currentSelectedCover = currentCover;

    if (coverInput && previewImg) {
      coverInput.addEventListener('input', () => {
        const val = coverInput.value.trim();
        if (!val.startsWith('Imagen guardada')) {
          currentSelectedCover = val;
          previewImg.src = val || firstSongThumb || '';
        }
      });
    }

    if (fileInput && previewImg) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            this.showToast('La imagen es demasiado pesada (máx 5MB)');
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            currentSelectedCover = ev.target.result;
            previewImg.src = currentSelectedCover;
            coverInput.value = 'Imagen seleccionada de tu ordenador';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (useThumbBtn && coverInput && previewImg) {
      useThumbBtn.addEventListener('click', () => {
        currentSelectedCover = firstSongThumb;
        coverInput.value = firstSongThumb;
        previewImg.src = firstSongThumb;
      });
    }

    document.getElementById('edit-pl-cancel-btn').addEventListener('click', () => this.closeModal());

    document.getElementById('edit-pl-save-btn').addEventListener('click', () => {
      const newName = nameInput.value.trim();
      if (newName) {
        Playlists.update(playlistId, { name: newName, cover: currentSelectedCover });
        this.closeModal();
        this.showToast('Carpeta actualizada');
        this.renderPlaylistView(playlistId);
      }
    });
  }

  renderSettingsView() {
    const container = document.getElementById('view-settings');
    if (!container) return;

    const apiKey = Config.getApiKey();
    const isAuth = Auth.isAuthenticated();
    const user = Auth.getUser();

    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Ajustes</h1>
        <p class="view-subtitle">Configuración y cuenta de usuario.</p>
      </div>

      <div style="max-width: 560px; display: flex; flex-direction: column; gap: 24px;">
        <!-- Perfil y Nombre de Usuario -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
          <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">Perfil de Usuario</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5;">
            Personaliza el nombre de usuario que se muestra como autor en las portadas de carpetas y en la barra superior.
          </p>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="settings-username-input" class="modal-input" style="margin-bottom: 0;" placeholder="Tu nombre o apodo..." value="${this.escapeHTML(Config.getUsername())}">
            <button class="btn btn-primary" id="save-username-btn">Guardar</button>
          </div>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">
            Nombre visible actual: <strong style="color: var(--text-primary);">${this.escapeHTML(this.getUserDisplayName())}</strong>
          </p>
        </div>

        <!-- Google Account & Cloud Sync -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
          <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 8px;">Cuenta de Google (Sincronización en la Nube)</h3>
          <p style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.5;">
            Conecta tu cuenta para sincronizar automáticamente tus carpetas, colección de CDs y preferencias en tu Google Drive personal (AppData).
          </p>

          ${isAuth && user ? `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${user.avatar || 'https://www.gstatic.com/images/branding/product/1x/avatar_square_blue_512dp.png'}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-subtle);" alt="">
                <div>
                  <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">${user.name}</div>
                  <div style="font-size: 11.5px; color: #10B981;">● Sincronizado con Google Drive</div>
                </div>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn btn-secondary" id="settings-sync-cloud-btn" style="font-size: 12px; padding: 6px 12px;">Sincronizar ahora</button>
                <button class="btn btn-primary" id="settings-sync-yt-btn" style="font-size: 12px; padding: 6px 14px;">Importar YouTube</button>
                <button class="btn btn-secondary" id="settings-logout-yt-btn" style="font-size: 12px; padding: 6px 12px; color: var(--danger);">Desconectar</button>
              </div>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px;">
              <button class="btn btn-primary" id="settings-login-yt-btn" style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 10px 16px; font-size: 13.5px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Iniciar sesión con Google
              </button>
            </div>
          `}
        </div>

        <!-- Estado del Servicio de Música & Búsqueda (API Key oculta para demostraciones y grabaciones) -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 14px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #10B981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);"></span>
            <div>
              <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary);">Servicio de Streaming & Búsqueda</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">Catálogo oficial activo y conectado</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #10B981; font-weight: 500; background: rgba(16, 185, 129, 0.1); padding: 5px 12px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.2);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            En línea
          </div>
        </div>

        <!-- Atajos de Teclado -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 20px;">
          <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Atajos de Teclado</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
            <div><kbd style="background: var(--bg-surface-elevated); padding: 3px 8px; border-radius: 4px; font-family: monospace;">Espacio</kbd> : Reproducir / Pausar</div>
            <div><kbd style="background: var(--bg-surface-elevated); padding: 3px 8px; border-radius: 4px; font-family: monospace;">← / →</kbd> : -5s / +5s</div>
            <div><kbd style="background: var(--bg-surface-elevated); padding: 3px 8px; border-radius: 4px; font-family: monospace;">↑ / ↓</kbd> : Subir / Bajar Volumen</div>
            <div><kbd style="background: var(--bg-surface-elevated); padding: 3px 8px; border-radius: 4px; font-family: monospace;">Esc</kbd> : Salir de Focus / Cerrar</div>
          </div>
        </div>
      </div>
    `;

    const saveUsernameBtn = document.getElementById('save-username-btn');
    if (saveUsernameBtn) {
      saveUsernameBtn.addEventListener('click', () => {
        const input = document.getElementById('settings-username-input');
        if (input) {
          Config.setUsername(input.value);
          this.showToast('Nombre de usuario guardado');
          this.renderUserBadge();
          this.renderSettingsView();
        }
      });
    }

    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    if (saveApiKeyBtn) {
      saveApiKeyBtn.addEventListener('click', () => {
        const input = document.getElementById('settings-api-key-input');
        if (input) {
          Config.setApiKey(input.value);
          this.showToast('API Key guardada');
          this.renderSettingsView();
        }
      });
    }

    const toggleChangeKeyBtn = document.getElementById('toggle-change-api-key-btn');
    if (toggleChangeKeyBtn) {
      toggleChangeKeyBtn.addEventListener('click', () => {
        const box = document.getElementById('settings-api-key-box');
        if (box) {
          const isHidden = box.style.display === 'none';
          box.style.display = isHidden ? 'block' : 'none';
          toggleChangeKeyBtn.textContent = isHidden ? 'Cancelar' : 'Modificar clave';
        }
      });
    }

    const loginYtBtn = document.getElementById('settings-login-yt-btn');
    if (loginYtBtn) {
      loginYtBtn.addEventListener('click', () => {
        Auth.login();
      });
    }

    const logoutYtBtn = document.getElementById('settings-logout-yt-btn');
    if (logoutYtBtn) {
      logoutYtBtn.addEventListener('click', () => {
        Auth.logout();
        this.renderUserBadge();
        this.renderSettingsView();
      });
    }

    const syncCloudBtn = document.getElementById('settings-sync-cloud-btn');
    if (syncCloudBtn) {
      syncCloudBtn.addEventListener('click', async () => {
        syncCloudBtn.disabled = true;
        const originalText = syncCloudBtn.textContent;
        syncCloudBtn.textContent = 'Sincronizando...';
        if (window.bluxCloudSync) {
          await window.bluxCloudSync.sync();
        }
        syncCloudBtn.disabled = false;
        syncCloudBtn.textContent = originalText;
        this.renderSettingsView();
      });
    }

    const syncYtBtn = document.getElementById('settings-sync-yt-btn');
    if (syncYtBtn) {
      syncYtBtn.addEventListener('click', () => {
        this.openImportYouTubePlaylistsModal();
      });
    }
  }

  renderUserBadge() {
    const badge = document.getElementById('topbar-user-badge') || document.getElementById('sidebar-user-badge');
    if (!badge) return;

    const displayName = this.getUserDisplayName();
    const avatar = this.getAvatarOrPlaceholder();
    const bio = this.getUserBio();

    badge.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px 12px 4px 6px; border-radius: 20px; background: rgba(255,255,255,0.06); border: 1px solid var(--border-subtle); transition: all var(--transition-fast);" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">
        <img src="${avatar}" class="sidebar-user-avatar" alt="${this.escapeHTML(displayName)}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
        <span class="sidebar-user-name" title="${this.escapeHTML(displayName)}" style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 500; color: var(--text-primary);">${this.escapeHTML(displayName)}</span>
      </div>
    `;
    badge.title = `Perfil de ${displayName}`;

    // Update Popover elements
    const popoverAvatar = document.getElementById('user-popover-avatar');
    if (popoverAvatar) popoverAvatar.src = avatar;
    const popoverName = document.getElementById('user-popover-name');
    if (popoverName) popoverName.textContent = displayName;
    const popoverBio = document.getElementById('user-popover-bio');
    if (popoverBio) popoverBio.textContent = bio.length > 32 ? bio.slice(0, 30) + '...' : bio;
  }

  async openImportYouTubePlaylistsModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    if (!modalBackdrop || !modalContent) return;

    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 class="modal-title" style="margin-bottom: 0;">Tus Carpetas de YouTube</h2>
        <button class="icon-btn" id="modal-close-import-btn" style="width: 28px; height: 28px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div id="yt-playlists-import-list" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
        <div style="color: var(--text-muted); text-align: center; padding: 24px 0;">Cargando tus listas de YouTube...</div>
      </div>
    `;

    modalBackdrop.classList.add('open');
    document.getElementById('modal-close-import-btn').addEventListener('click', () => this.closeModal());

    try {
      const playlists = await Auth.fetchUserPlaylists();
      const listContainer = document.getElementById('yt-playlists-import-list');
      if (!listContainer) return;

      if (playlists.length === 0) {
        listContainer.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 24px 0;">No se encontraron listas en tu cuenta de YouTube.</div>`;
        return;
      }

      listContainer.innerHTML = playlists.map(pl => `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            <img src="${pl.thumbnail}" style="width: 44px; height: 44px; border-radius: 4px; object-fit: cover; background: #1a1a1e;" alt="">
            <div style="min-width: 0;">
              <div style="font-size: 13.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pl.title}</div>
              <div style="font-size: 11.5px; color: var(--text-muted);">${pl.itemCount} canciones</div>
            </div>
          </div>
          <button class="btn btn-secondary import-single-pl-btn" data-pl-id="${pl.id}" data-pl-title="${pl.title.replace(/"/g, '&quot;')}" style="font-size: 12px; padding: 6px 14px; flex-shrink: 0;">
            Importar
          </button>
        </div>
      `).join('');

      listContainer.querySelectorAll('.import-single-pl-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const plId = btn.dataset.plId;
          const plTitle = btn.dataset.plTitle;
          btn.textContent = 'Importando...';
          btn.disabled = true;
          try {
            const imported = await Auth.importPlaylist(plId, plTitle);
            btn.textContent = '✓ Importada';
            btn.style.borderColor = '#10B981';
            btn.style.color = '#10B981';
            this.showToast(`Carpeta "${imported.name}" importada (${imported.songs.length} canciones)`);
          } catch (e) {
            btn.textContent = 'Error';
            btn.disabled = false;
            this.showToast('Error al importar la carpeta.');
          }
        });
      });
    } catch (err) {
      const listContainer = document.getElementById('yt-playlists-import-list');
      if (listContainer) {
        listContainer.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 24px 0;">${err.message || 'Error al conectar con YouTube'}</div>`;
      }
    }
  }

  async performSearch(query) {
    const container = document.getElementById('view-search');
    if (!container) return;

    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Resultados de búsqueda</h1>
        <p class="view-subtitle">Buscando "${this.escapeHTML(query)}"...</p>
      </div>
      <div style="margin-bottom: 24px;">
        <div class="skeleton" style="width: 100px; height: 16px; margin-bottom: 12px;"></div>
        <div class="artist-grid">
          ${Array(3).fill(0).map(() => `
            <div class="artist-card" style="opacity: 0.6;">
              <div class="skeleton" style="width: 104px; height: 104px; border-radius: 50%; margin-bottom: 12px;"></div>
              <div class="skeleton" style="width: 80px; height: 14px; margin-bottom: 6px;"></div>
              <div class="skeleton" style="width: 50px; height: 11px;"></div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="song-list">
        ${Array(6).fill(0).map(() => `
          <div class="song-row" style="opacity: 0.6;">
            <div class="skeleton" style="width: 24px; height: 16px;"></div>
            <div class="skeleton" style="width: 40px; height: 40px;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 180px; height: 14px;"></div>
              <div class="skeleton" style="width: 100px; height: 12px;"></div>
            </div>
            <div class="skeleton" style="width: 80px; height: 12px;"></div>
            <div class="skeleton" style="width: 40px; height: 12px;"></div>
          </div>
        `).join('')}
      </div>
    `;

    const searchResponse = await YouTubeAPI.search(query);

    if (searchResponse.error) {
      container.innerHTML = `
        <div class="view-header">
          <h1 class="view-title">Resultados</h1>
          <p class="view-subtitle" style="color: var(--danger);">${this.escapeHTML(searchResponse.error)}</p>
        </div>
        <p style="color: var(--text-muted); font-size: 13.5px;">Comprueba tu conexión o verifica tu clave de API en Ajustes.</p>
      `;
      return;
    }

    const artists = (searchResponse.artists || []).slice(0, 2);
    const tracks = searchResponse.tracks || searchResponse.results || [];

    let html = `
      <div class="view-header">
        <h1 class="view-title">Resultados para "${this.escapeHTML(query)}"</h1>
        <p class="view-subtitle">${tracks.length} canciones encontradas ${searchResponse.isFallback ? '• (Catálogo de muestra)' : ''}</p>
      </div>
    `;

    if (searchResponse.isFallback && searchResponse.message) {
      html += `
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); padding: 12px 18px; border-radius: var(--radius-md); margin-bottom: 24px; font-size: 13px; color: var(--text-secondary); display: flex; justify-content: space-between; align-items: center;">
          <span>${searchResponse.message}</span>
          <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="window.bluxUI.showView('settings')">Ir a Ajustes</button>
        </div>
      `;
    }

    // ARTIST SECTION (Separated from songs, deduplicated and capped to 1-2)
    if (artists.length > 0) {
      html += `
        <div style="margin-bottom: 32px;">
          <h2 style="font-size: 17px; font-weight: 600; margin-bottom: 16px;">Artistas</h2>
          <div class="artist-grid">
            ${artists.map(a => this.renderArtistCardHTML(a)).join('')}
          </div>
        </div>
      `;
    }

    // SONGS SECTION
    html += `
      <div style="margin-bottom: 32px;">
        <h2 style="font-size: 17px; font-weight: 600; margin-bottom: 16px;">Canciones</h2>
        ${tracks.length === 0 ? `
          <div style="padding: 32px 0; color: var(--text-muted);">No se encontraron canciones para "${this.escapeHTML(query)}".</div>
        ` : `
          <div class="song-list">
            ${tracks.map((track, idx) => this.renderSongRowHTML(track, idx)).join('')}
          </div>
        `}
      </div>
    `;

    container.innerHTML = html;
    this.attachCardEventListeners(container, tracks);
  }

  renderArtistCardHTML(artist) {
    const avatar = artist.avatar;
    return `
      <div class="artist-card" data-artist-name="${this.escapeHTML(artist.name)}" data-channel-id="${artist.id || ''}">
        <div class="artist-avatar-wrapper">
          ${avatar ? `
            <img src="${avatar}" class="artist-avatar" alt="${this.escapeHTML(artist.name)}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'artist-avatar-fallback\\'><svg width=\\'36\\' height=\\'36\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><path d=\\'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\\'/><circle cx=\\'12\\' cy=\\'7\\' r=\\'4\\'/></svg></div>';">
          ` : `
            <div class="artist-avatar-fallback">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          `}
        </div>
        <div class="artist-card-name" title="${this.escapeHTML(artist.name)}">${this.escapeHTML(artist.name)}</div>
        <div class="artist-card-badge">${this.escapeHTML(artist.subscribers || 'Artista')}</div>
      </div>
    `;
  }

  async renderArtistView(artistName, channelId = null) {
    const container = document.getElementById('view-artist');
    if (!container) return;

    this.showView('artist');

    container.innerHTML = `
      <button class="btn btn-secondary" id="back-from-artist-btn" style="margin-bottom: 20px; font-size: 12px; padding: 4px 12px;">← Volver</button>
      <div class="artist-profile-header">
        <div class="skeleton" style="width: 140px; height: 140px; border-radius: 50%;"></div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
          <div class="skeleton" style="width: 100px; height: 14px;"></div>
          <div class="skeleton" style="width: 250px; height: 32px;"></div>
          <div class="skeleton" style="width: 150px; height: 14px;"></div>
        </div>
      </div>
      <div class="song-list">
        ${Array(6).fill(0).map(() => `
          <div class="song-row" style="opacity: 0.6;">
            <div class="skeleton" style="width: 24px; height: 16px;"></div>
            <div class="skeleton" style="width: 40px; height: 40px;"></div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div class="skeleton" style="width: 180px; height: 14px;"></div>
              <div class="skeleton" style="width: 100px; height: 12px;"></div>
            </div>
            <div class="skeleton" style="width: 80px; height: 12px;"></div>
            <div class="skeleton" style="width: 40px; height: 12px;"></div>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('back-from-artist-btn')?.addEventListener('click', () => {
      this.showView('search');
    });

    const profile = await YouTubeAPI.getArtistProfile(artistName, channelId);
    const { artist, tracks } = profile;

    container.innerHTML = `
      <button class="btn btn-secondary" id="back-from-artist-btn" style="margin-bottom: 20px; font-size: 12px; padding: 4px 12px;">← Volver</button>
      <div class="artist-profile-header">
        <img src="${artist.avatar}" class="artist-profile-avatar" alt="${this.escapeHTML(artist.name)}">
        <div class="artist-profile-meta">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--accent-primary); margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"></circle><polygon points="12 8 15 14 9 14" fill="#09090b"></polygon></svg>
            Perfil de artista
          </div>
          <h1 class="view-title" style="font-size: 32px; margin-bottom: 6px;">${this.escapeHTML(artist.name)}</h1>
          <p class="view-subtitle">${this.escapeHTML(artist.subscribers || 'Artista en YouTube')} ${artist.description ? `• ${this.escapeHTML(artist.description)}` : ''}</p>
          <div style="display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap;">
            ${tracks.length > 0 ? `
              <button class="btn btn-primary" id="artist-play-all-btn" style="padding: 8px 22px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Reproducir canciones
              </button>
              <button class="btn btn-secondary" id="artist-queue-all-btn" style="padding: 8px 16px;">
                + Añadir a mi fila
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 18px; font-weight: 600; margin-bottom: 16px;">Canciones destacadas</h2>
        ${tracks.length === 0 ? `
          <div style="padding: 32px 0; color: var(--text-muted);">No se encontraron canciones disponibles para este artista.</div>
        ` : `
          <div class="song-list">
            ${tracks.map((t, idx) => this.renderSongRowHTML(t, idx)).join('')}
          </div>
        `}
      </div>
    `;

    this.attachCardEventListeners(container, tracks);

    document.getElementById('back-from-artist-btn')?.addEventListener('click', () => {
      this.showView('search');
    });

    document.getElementById('artist-play-all-btn')?.addEventListener('click', () => {
      if (tracks.length > 0) {
        Queue.setQueue(tracks, 0);
        this.showToast(`Reproduciendo canciones de ${artist.name}`);
      }
    });

    document.getElementById('artist-queue-all-btn')?.addEventListener('click', () => {
      tracks.forEach(t => Queue.add(t));
      this.showToast(`${tracks.length} canciones añadidas a tu fila`);
    });
  }

  showContextMenu(e, track, fromPlaylistId = null) {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    const hasCD = CDCollection.hasCD(track.id);
    menu.innerHTML = `
      <div class="context-menu-item" id="ctx-play-now">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        <span>Reproducir ahora</span>
      </div>
      <div class="context-menu-item" id="ctx-play-next">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
        <span>Reproducir siguiente</span>
      </div>
      <div class="context-menu-item" id="ctx-add-queue">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>Añadir a la fila</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" id="ctx-view-artist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a8.5 8.5 0 0 1 13 0"></path></svg>
        <span>Ver perfil de artista</span>
      </div>
      <div class="context-menu-item" id="ctx-toggle-fav">
        <svg viewBox="0 0 24 24" fill="${hasCD ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        <span>${hasCD ? 'Quitar CD de la colección' : 'Quedarme este CD'}</span>
      </div>
      <div class="context-menu-item" id="ctx-add-playlist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        <span>Añadir a una carpeta...</span>
      </div>
      ${fromPlaylistId ? `
        <div class="context-menu-divider"></div>
        <div class="context-menu-item danger" id="ctx-remove-playlist">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <span>Quitar de esta carpeta</span>
        </div>
      ` : ''}
    `;

    menu.classList.add('open');
    const menuWidth = 220;
    const menuHeight = fromPlaylistId ? 260 : 220;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth - 12) {
      posX = window.innerWidth - menuWidth - 12;
    }
    if (posY + menuHeight > window.innerHeight - 12) {
      posY = window.innerHeight - menuHeight - 12;
    }

    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;

    document.getElementById('ctx-play-now')?.addEventListener('click', () => {
      this.closeContextMenu();
      Queue.addNext(track);
      Queue.next();
    });

    document.getElementById('ctx-play-next')?.addEventListener('click', () => {
      this.closeContextMenu();
      Queue.addNext(track);
      this.showToast('Añadido para reproducir siguiente');
    });

    document.getElementById('ctx-add-queue')?.addEventListener('click', () => {
      this.closeContextMenu();
      Queue.add(track);
      this.showToast('Añadido a tu fila');
    });

    document.getElementById('ctx-view-artist')?.addEventListener('click', () => {
      this.closeContextMenu();
      this.renderArtistView(track.artist, track.channelId);
    });

    document.getElementById('ctx-toggle-fav')?.addEventListener('click', () => {
      this.closeContextMenu();
      const added = CDCollection.toggleCD(track, 'collection');
      this.showToast(added ? '¡Te quedaste el CD! Guardado en tu colección' : 'CD retirado de tu colección');
      this.updateFavoriteButton();
    });

    document.getElementById('ctx-add-playlist')?.addEventListener('click', () => {
      this.closeContextMenu();
      this.openSongActionsModal(track, fromPlaylistId);
    });

    if (fromPlaylistId) {
      document.getElementById('ctx-remove-playlist')?.addEventListener('click', () => {
        this.closeContextMenu();
        Playlists.removeSong(fromPlaylistId, track.id);
        this.showToast('Eliminada de la carpeta');
      });
    }
  }

  closeContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.classList.remove('open');
  }

  updateShuffleButtons(isShuffle) {
    const shuffleBtn = document.getElementById('player-shuffle-btn');
    const focusShuffleBtn = document.getElementById('focus-shuffle-btn');
    if (shuffleBtn) shuffleBtn.classList.toggle('active', !!isShuffle);
    if (focusShuffleBtn) focusShuffleBtn.classList.toggle('active', !!isShuffle);
  }

  renderPlaylistCardHTML(pl) {
    const cover1 = pl.customCover || (pl.songs && pl.songs[0] && pl.songs[0].thumbnail) || null;
    const cover2 = (pl.songs && pl.songs[1] && pl.songs[1].thumbnail) || null;
    const songCount = pl.songs ? pl.songs.length : 0;

    return `
      <div class="cd-wallet-card song-card" data-playlist-id="${pl.id}" title="${this.escapeHTML(pl.name)}">
        <!-- 3D CD Libreta / Booklet Stage (Incline Perspective) -->
        <div class="cd-libreta-stage">
          <div class="cd-libreta-3d">
            <!-- Zippered Base Shell (Open Binder Tray) -->
            <div class="libreta-casing-base">
              <div class="libreta-stitch-rim"></div>
              <div class="libreta-zipper-teeth"></div>
              <div class="libreta-zipper-pull-hinge"></div>
              <div class="libreta-center-seam"></div>
            </div>

            <!-- Page 0: Bottom base sleeve under the turned page -->
            <div class="libreta-page-under">
              <div class="libreta-under-cloth"></div>
            </div>

            <!-- Page 2: Right Flat Sleeve with Disc #2 -->
            <div class="libreta-page-flat">
              <div class="cd-silver-disc">
                <div class="cd-silver-specular"></div>
                <div class="cd-silver-grooves"></div>
                <div class="cd-silver-label">
                  ${cover2 ? `
                    <img src="${cover2}" alt="" loading="lazy">
                  ` : `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #18181b; color: #d4d4d8; font-size: 8px; font-weight: 600; text-align: center; padding: 2px; border: 1px solid rgba(255,255,255,0.15);">
                      BLUX
                    </div>
                  `}
                </div>
                <div class="cd-silver-hole"></div>
              </div>
              <!-- Frosted Vinyl Pocket with Top Insertion Slot -->
              <div class="libreta-vinyl-pocket"></div>
              <div class="libreta-sleeve-notch"></div>
            </div>

            <!-- Page 1: Raised / Turned Page Standing in 3D Perspective with Disc #1 -->
            <div class="libreta-page-lifted">
              <div class="cd-silver-disc">
                <div class="cd-silver-specular"></div>
                <div class="cd-silver-grooves"></div>
                <div class="cd-silver-label">
                  ${cover1 ? `
                    <img src="${cover1}" alt="" loading="lazy">
                  ` : `
                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #18181b; color: #e4e4e7; font-size: 9px; font-weight: 700; border: 1px solid rgba(255,255,255,0.15);">
                      CD 1
                    </div>
                  `}
                </div>
                <div class="cd-silver-hole"></div>
              </div>
              <!-- Frosted Vinyl Pocket with Top Insertion Slot -->
              <div class="libreta-vinyl-pocket"></div>
              <div class="libreta-sleeve-notch"></div>
            </div>
          </div>
          <!-- Ground Shadow -->
          <div class="libreta-floor-shadow"></div>
        </div>

        <!-- Metadata below (Clean: NO "PORTA CDS" tag) -->
        <div class="cd-wallet-info">
          <div class="cd-wallet-title">${this.escapeHTML(pl.name)}</div>
          <div class="cd-wallet-meta">
            <span>${songCount} ${songCount === 1 ? 'canción' : 'canciones'}</span>
            <span>•</span>
            <span>${this.escapeHTML(this.getUserDisplayName())}</span>
          </div>
        </div>
      </div>
    `;
  }

  renderSongCardHTML(track) {
    const isCurrent = Player.currentTrack && Player.currentTrack.id === track.id;
    const isPlaying = isCurrent && Player.isPlaying;
    const cleanArtistName = this.cleanArtist(track.artist);

    return `
      <div class="song-card ${isCurrent ? 'is-playing' : ''}" data-track-id="${track.id}" data-track='${JSON.stringify(track).replace(/'/g, "&apos;")}'>
        <div class="song-card-case">
          <div class="case-cd-slider">
            <div class="case-cd-disc" style="animation-play-state: ${isCurrent && isPlaying ? 'running' : 'paused'};">
              <div class="case-cd-grooves"></div>
              <div class="case-cd-radial-texture"></div>
              <div class="case-cd-label">
                <img src="${track.thumbnail}" alt="" loading="lazy" decoding="async">
              </div>
              <div class="case-cd-hole"></div>
            </div>
          </div>
          <div class="song-card-cover-wrapper">
            <div class="cd-case-spine"></div>
            <img src="${track.thumbnail}" alt="${this.escapeHTML(track.title)}" class="song-card-cover" loading="lazy" decoding="async">
            <div class="cd-case-glare"></div>
          </div>
        </div>
        <div class="song-card-title" title="${this.escapeHTML(track.title)}">${this.escapeHTML(track.title)}</div>
        <div class="song-card-artist" title="${this.escapeHTML(cleanArtistName)}">${this.escapeHTML(cleanArtistName)}</div>
      </div>
    `;
  }

  renderCompactSongCardHTML(track, idx, playlistId = null) {
    const isCurrent = Player.currentTrack && Player.currentTrack.id === track.id;
    const isPlaying = isCurrent && Player.isPlaying;
    const cleanArtistName = this.cleanArtist(track.artist);

    return `
      <div class="compact-cd-card ${isCurrent ? 'is-playing' : ''}" data-track-id="${track.id}" data-track='${JSON.stringify(track).replace(/'/g, "&apos;")}' data-playlist-id="${playlistId || ''}" data-track-index="${idx}">
        <div class="compact-cd-case">
          <div class="case-cd-slider">
            <div class="case-cd-disc" style="animation-play-state: ${isCurrent && isPlaying ? 'running' : 'paused'};">
              <div class="case-cd-grooves"></div>
              <div class="case-cd-radial-texture"></div>
              <div class="case-cd-label">
                <img src="${track.thumbnail}" alt="" loading="lazy" decoding="async">
              </div>
              <div class="case-cd-hole"></div>
            </div>
          </div>
          <div class="compact-cd-cover-wrapper">
            <div class="compact-spine"></div>
            <img src="${track.thumbnail}" alt="${this.escapeHTML(track.title)}" class="compact-cd-cover" loading="lazy" decoding="async">
            <div class="cd-case-glare"></div>
          </div>
        </div>
        <div class="compact-cd-title" title="${this.escapeHTML(track.title)}">${this.escapeHTML(track.title)}</div>
        <div class="compact-cd-artist" title="${this.escapeHTML(cleanArtistName)}">${this.escapeHTML(cleanArtistName)}</div>
      </div>
    `;
  }

  renderSongRowHTML(track, idx, playlistId = null) {
    const isCurrent = Player.currentTrack && Player.currentTrack.id === track.id;
    const cleanArtistName = this.cleanArtist(track.artist);
    return `
      <div class="song-row ${isCurrent ? 'playing' : ''}" data-track-id="${track.id}" data-track='${JSON.stringify(track).replace(/'/g, "&apos;")}' data-playlist-id="${playlistId || ''}">
        <div class="song-row-index">${idx + 1}</div>
        <img src="${track.thumbnail}" class="song-row-thumbnail" loading="lazy" decoding="async" alt="${this.escapeHTML(track.title)}">
        <div class="song-row-info">
          <div class="song-row-title" title="${this.escapeHTML(track.title)}">${this.escapeHTML(track.title)}</div>
          <div class="song-row-artist" title="Ver perfil de ${this.escapeHTML(cleanArtistName)}">${this.escapeHTML(cleanArtistName)}</div>
        </div>
        <div class="song-row-album" title="Ver perfil de ${this.escapeHTML(cleanArtistName)}">${this.escapeHTML(cleanArtistName)}</div>
        <div class="song-row-duration">${track.duration || '--:--'}</div>
        <div style="display: flex; justify-content: flex-end; gap: 4px;">
          <button class="icon-btn song-menu-btn" title="Opciones" data-track-id="${track.id}" style="width: 28px; height: 28px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  attachCardEventListeners(container, trackList = null) {
    // Artist card click -> Explore artist profile
    container.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => {
        const artistName = card.dataset.artistName;
        const channelId = card.dataset.channelId;
        if (artistName) {
          this.renderArtistView(artistName, channelId);
        }
      });
    });

    // Play on song card click
    container.querySelectorAll('.song-card[data-track]').forEach(card => {
      card.addEventListener('click', (e) => {
        try {
          const track = JSON.parse(card.dataset.track);
          if (Player.currentTrack && Player.currentTrack.id === track.id) {
            Player.togglePlay();
          } else {
            Queue.playTrack(track, trackList);
          }
        } catch (err) {
          console.error(err);
        }
      });

      // Right click context menu on song card
      card.addEventListener('contextmenu', (e) => {
        try {
          const track = JSON.parse(card.dataset.track);
          this.showContextMenu(e, track);
        } catch (err) {}
      });
    });

    // Play on playlist card click
    container.querySelectorAll('.song-card[data-playlist-id], .cd-wallet-card[data-playlist-id]').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.playlistId;
        this.renderPlaylistView(id);
      });
    });

    // Compact CD card interactions inside playlists
    container.querySelectorAll('.compact-cd-card[data-track]').forEach(card => {
      card.addEventListener('click', (e) => {
        try {
          const track = JSON.parse(card.dataset.track);
          const playlistId = card.dataset.playlistId;
          const trackIndex = parseInt(card.dataset.trackIndex, 10);
          if (Player.currentTrack && Player.currentTrack.id === track.id) {
            Player.togglePlay();
          } else if (playlistId && !isNaN(trackIndex)) {
            Playlists.play(playlistId, trackIndex);
          } else {
            Queue.playTrack(track, trackList);
          }
        } catch (err) {
          console.error(err);
        }
      });

      card.addEventListener('contextmenu', (e) => {
        try {
          const track = JSON.parse(card.dataset.track);
          const playlistId = card.dataset.playlistId || null;
          this.showContextMenu(e, track, playlistId);
        } catch (err) {}
      });
    });

    // Song row interactions
    container.querySelectorAll('.song-row').forEach((row, rowIndex) => {
      // Click to play
      row.addEventListener('click', (e) => {
        if (e.target.closest('.song-menu-btn')) return; // handled by options
        if (e.target.closest('.song-row-artist')) return; // handled by artist link
        try {
          const track = JSON.parse(row.dataset.track);
          if (Player.currentTrack && Player.currentTrack.id === track.id) {
            Player.togglePlay();
          } else if (trackList && trackList.length > 0) {
            Queue.setQueue(trackList, rowIndex);
          } else {
            Queue.playTrack(track, trackList);
          }
        } catch (err) {
          console.error(err);
        }
      });

      // Right click context menu on song row
      row.addEventListener('contextmenu', (e) => {
        try {
          const track = JSON.parse(row.dataset.track);
          const playlistId = row.dataset.playlistId || null;
          this.showContextMenu(e, track, playlistId);
        } catch (err) {}
      });

      // Click on artist inside row opens artist profile
      const artistEl = row.querySelector('.song-row-artist');
      if (artistEl) {
        artistEl.style.cursor = 'pointer';
        artistEl.addEventListener('click', (e) => {
          e.stopPropagation();
          try {
            const track = JSON.parse(row.dataset.track);
            this.renderArtistView(track.artist, track.channelId);
          } catch (err) {}
        });
      }

      // Song row 3-dots button
      const menuBtn = row.querySelector('.song-menu-btn');
      if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const track = JSON.parse(row.dataset.track);
          const playlistId = row.dataset.playlistId || null;
          this.openSongActionsModal(track, playlistId);
        });
      }
    });
  }

  renderSidebarPlaylists() {
    const list = document.getElementById('sidebar-playlists-list');
    if (!list) return;

    const playlists = Playlists.getAll();
    list.innerHTML = playlists.map(pl => `
      <div class="sidebar-playlist-item ${this.activePlaylistId === pl.id && this.currentView === 'playlist' ? 'active' : ''}" data-pl-id="${pl.id}" title="${pl.name}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
        <span>${pl.name}</span>
      </div>
    `).join('');

    list.querySelectorAll('[data-pl-id]').forEach(item => {
      item.addEventListener('click', () => {
        const popover = document.getElementById('topbar-playlists-popover');
        if (popover) popover.classList.remove('open');
        this.renderPlaylistView(item.dataset.plId);
      });
    });
  }

  updateTrackInfo(track) {
    if (!track) return;

    // Mini Player
    const titleEl = document.getElementById('player-title');
    const artistEl = document.getElementById('player-artist');
    const coverEl = document.getElementById('player-cover');
    const cleanArtist = this.cleanArtist(track.artist);

    if (titleEl) titleEl.textContent = track.title;
    if (artistEl) artistEl.textContent = cleanArtist;
    if (coverEl) coverEl.src = track.thumbnail;

    // Focus Mode (Living Room TV Canvas)
    const focusTitle = document.getElementById('focus-title');
    const focusArtist = document.getElementById('focus-artist');
    const focusCover = document.getElementById('focus-cover');
    const focusCaseCover = document.getElementById('focus-case-cover');
    const focusExtra = document.getElementById('focus-extra-info');

    if (focusTitle) focusTitle.textContent = track.title;
    if (focusArtist) focusArtist.textContent = cleanArtist;
    if (focusExtra) focusExtra.textContent = track.duration || 'Hi-Fi Audio';
    if (focusCaseCover) focusCaseCover.src = track.thumbnail;

    const ambientGlow = document.getElementById('focus-ambient-glow');
    if (ambientGlow) {
      try {
        const hex = ColorExtractor.getDominantColorHex(track.thumbnail);
        if (hex) {
          ambientGlow.style.background = `radial-gradient(circle at 50% 45%, ${hex}55 0%, ${hex}18 50%, transparent 72%)`;
        }
      } catch (e) {
        ambientGlow.style.background = 'radial-gradient(circle at 50% 45%, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.1) 50%, transparent 72%)';
      }
    }
    if (focusCover) {
      if (focusCover.src !== track.thumbnail) {
        focusCover.style.transition = 'opacity 250ms ease';
        focusCover.style.opacity = '0';
        setTimeout(() => {
          focusCover.src = track.thumbnail;
          focusCover.style.opacity = '1';
        }, 120);
      }
    }

    this.updateFavoriteButton();
    this.highlightActiveRow();
  }

  updatePlayPauseIcons(isPlaying) {
    const playSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const pauseSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

    const miniPlayBtn = document.getElementById('player-play-btn');
    if (miniPlayBtn) miniPlayBtn.innerHTML = isPlaying ? pauseSvg : playSvg;

    const focusPlayBtn = document.getElementById('focus-play-btn');
    if (focusPlayBtn) focusPlayBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
    // Toggle CD disc spin in Focus Mode
    const focusDisc = document.getElementById('focus-cd-disc');
    if (focusDisc) {
      focusDisc.classList.toggle('spinning', isPlaying);
      focusDisc.style.animationPlayState = isPlaying ? 'running' : 'paused';
    }

    // Update active state and icons on song cards and song rows
    this.highlightActiveRow();
  }

  updateProgress(currentTime, duration, progress) {
    const formattedCurrent = this.formatTime(currentTime);
    const formattedTotal = this.formatTime(duration);

    if (!this._cachedDom) {
      this._cachedDom = {
        curTimeEl: document.getElementById('player-time-current'),
        durTimeEl: document.getElementById('player-time-duration'),
        fillEl: document.getElementById('player-slider-fill'),
        inputEl: document.getElementById('player-progress-input'),
        focusCurTime: document.getElementById('focus-time-current'),
        focusDurTime: document.getElementById('focus-time-duration'),
        focusFill: document.getElementById('focus-slider-fill'),
        focusInput: document.getElementById('focus-progress-input')
      };
    }

    const dom = this._cachedDom;

    if (dom.curTimeEl && dom.curTimeEl.textContent !== formattedCurrent) {
      dom.curTimeEl.textContent = formattedCurrent;
    }
    if (dom.durTimeEl && dom.durTimeEl.textContent !== formattedTotal) {
      dom.durTimeEl.textContent = formattedTotal;
    }
    if (dom.fillEl) dom.fillEl.style.width = `${progress}%`;
    if (dom.inputEl && document.activeElement !== dom.inputEl) dom.inputEl.value = progress;

    if (dom.focusCurTime && dom.focusCurTime.textContent !== formattedCurrent) {
      dom.focusCurTime.textContent = formattedCurrent;
    }
    if (dom.focusDurTime && dom.focusDurTime.textContent !== formattedTotal) {
      dom.focusDurTime.textContent = formattedTotal;
    }
    if (dom.focusFill) dom.focusFill.style.width = `${progress}%`;
    if (dom.focusInput && document.activeElement !== dom.focusInput) dom.focusInput.value = progress;
  }

  updateVolumeSlider(volume) {
    const volumeSlider = document.getElementById('volume-slider');
    const volumeFill = document.getElementById('volume-fill');
    if (volumeSlider) volumeSlider.value = volume;
    if (volumeFill) volumeFill.style.width = `${volume}%`;
  }

  updateFavoriteButton() {
    const favBtn = document.getElementById('player-fav-btn');
    const focusFavBtn = document.getElementById('focus-fav-btn');
    if (!Player.currentTrack) return;

    const hasCD = CDCollection.has(Player.currentTrack.id);
    if (favBtn) {
      favBtn.classList.toggle('active', hasCD);
      favBtn.title = hasCD ? 'En tu colección de CDs' : 'Quedarme el CD (Colección)';
    }
    if (focusFavBtn) {
      focusFavBtn.classList.toggle('active', hasCD);
      focusFavBtn.title = hasCD ? 'En tu colección de CDs' : 'Quedarme el CD';
    }
  }

  highlightActiveRow() {
    const currentTrack = Player.currentTrack;
    const isPlaying = Player.isPlaying;

    document.querySelectorAll('.song-row').forEach(row => {
      try {
        const trackId = row.dataset.trackId;
        row.classList.toggle('playing', !!(currentTrack && trackId === currentTrack.id));
      } catch {}
    });

    document.querySelectorAll('.song-card[data-track-id]').forEach(card => {
      try {
        const trackId = card.dataset.trackId;
        const isCurrent = !!(currentTrack && trackId === currentTrack.id);
        card.classList.toggle('is-playing', isCurrent);

        const disc = card.querySelector('.case-cd-disc');
        if (disc) {
          disc.style.animationPlayState = (isCurrent && isPlaying) ? 'running' : 'paused';
        }
      } catch {}
    });

    document.querySelectorAll('.shelf-cd-item[data-cd-id]').forEach(item => {
      const cdId = item.dataset.cdId;
      const isCurrent = !!(currentTrack && cdId === currentTrack.id);
      item.classList.toggle('is-playing', isCurrent);
    });
  }

  renderQueuePanel(queueData) {
    const list = document.getElementById('queue-list-container');
    const countEl = document.getElementById('queue-count');
    if (!list) return;

    if (!queueData || Array.isArray(queueData)) {
      queueData = Queue.getQueue();
    }

    const { currentTrack, userQueue = [], upcomingContext = [], isShuffle = false } = queueData;
    const totalCount = (currentTrack ? 1 : 0) + userQueue.length + upcomingContext.length;

    if (countEl) {
      countEl.textContent = `${totalCount} canciones ${isShuffle ? '• Aleatorio' : ''}`;
    }

    if (totalCount === 0) {
      list.innerHTML = `<div style="color: var(--text-muted); text-align: center; margin-top: 40px; font-size: 13px;">La cola está vacía.</div>`;
      return;
    }

    let html = '';

    // 1. En reproducción
    if (currentTrack) {
      html += `
        <div class="queue-section-header">
          <span>En reproducción</span>
        </div>
        <div class="queue-item current" style="border-left: 2px solid var(--accent);">
          <img src="${currentTrack.thumbnail}" class="queue-item-thumb" alt="${this.escapeHTML(currentTrack.title)}">
          <div class="queue-item-meta">
            <div class="queue-item-title" style="color: var(--accent);">${this.escapeHTML(currentTrack.title)}</div>
            <div class="queue-item-artist">${this.escapeHTML(this.cleanArtist(currentTrack.artist))}</div>
          </div>
          <div style="font-size: 10px; color: var(--accent); font-weight: 600; padding: 2px 6px; background: rgba(99, 102, 241, 0.15); border-radius: 4px;">Sonando</div>
        </div>
      `;
    }

    // 2. A continuación en la fila (Manual User Queue)
    if (userQueue.length > 0) {
      html += `
        <div class="queue-section-header" style="margin-top: 14px;">
          <span>A continuación en tu fila</span>
          <button id="queue-clear-user-btn" style="background: none; border: none; font-size: 11px; color: var(--text-muted); cursor: pointer; text-decoration: underline;">Borrar fila</button>
        </div>
        ${userQueue.map((track, idx) => `
          <div class="queue-item user-queue-item" data-user-idx="${idx}">
            <img src="${track.thumbnail}" class="queue-item-thumb" alt="${this.escapeHTML(track.title)}">
            <div class="queue-item-meta">
              <div class="queue-item-title">${this.escapeHTML(track.title)}</div>
              <div class="queue-item-artist">${this.escapeHTML(this.cleanArtist(track.artist))}</div>
            </div>
            <span class="queue-badge-user">Fila</span>
            <button class="icon-btn queue-user-remove-btn" title="Quitar de tu fila" data-user-remove-idx="${idx}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `).join('')}
      `;
    }

    // 3. Siguiente de la lista / contexto
    if (upcomingContext.length > 0) {
      html += `
        <div class="queue-section-header" style="margin-top: 14px;">
          <span>Siguiente de la lista ${isShuffle ? '(Aleatorio)' : ''}</span>
        </div>
        ${upcomingContext.slice(0, 30).map((track, idx) => {
          const actualContextIdx = (queueData.contextIndex ?? 0) + 1 + idx;
          return `
            <div class="queue-item context-queue-item" data-context-idx="${actualContextIdx}">
              <img src="${track.thumbnail}" class="queue-item-thumb" alt="${this.escapeHTML(track.title)}">
              <div class="queue-item-meta">
                <div class="queue-item-title">${this.escapeHTML(track.title)}</div>
                <div class="queue-item-artist">${this.escapeHTML(this.cleanArtist(track.artist))}</div>
              </div>
            </div>
          `;
        }).join('')}
      `;
    }

    list.innerHTML = html;

    // Bind User Queue actions
    document.getElementById('queue-clear-user-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      Queue.clearUserQueue();
      this.showToast('Fila manual borrada');
    });

    list.querySelectorAll('.user-queue-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.queue-user-remove-btn')) return;
        const idx = parseInt(item.dataset.userIdx, 10);
        Queue.playUserQueueIndex(idx);
      });
    });

    list.querySelectorAll('.queue-user-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.userRemoveIdx, 10);
        Queue.removeUserQueue(idx);
      });
    });

    list.querySelectorAll('.context-queue-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.contextIdx, 10);
        Queue.playIndex(idx);
      });
    });
  }

  toggleQueue(forceState = null) {
    const panel = document.getElementById('queue-panel');
    if (!panel) return;

    this.isQueueOpen = forceState !== null ? forceState : !this.isQueueOpen;
    panel.classList.toggle('open', this.isQueueOpen);
  }

  initFocusIdleTimer() {
    this.clearFocusIdleTimer();
    const overlay = document.getElementById('focus-overlay');
    if (!overlay) return;

    overlay.classList.remove('is-idle');

    this._focusIdleReset = () => {
      overlay.classList.remove('is-idle');
      clearTimeout(this._focusIdleTimeout);
      this._focusIdleTimeout = setTimeout(() => {
        if (this.isFocusMode) {
          overlay.classList.add('is-idle');
        }
      }, 4500);
    };

    window.addEventListener('mousemove', this._focusIdleReset);
    window.addEventListener('touchstart', this._focusIdleReset, { passive: true });
    this._focusIdleReset();
  }

  clearFocusIdleTimer() {
    const overlay = document.getElementById('focus-overlay');
    if (overlay) overlay.classList.remove('is-idle');
    clearTimeout(this._focusIdleTimeout);
    if (this._focusIdleReset) {
      window.removeEventListener('mousemove', this._focusIdleReset);
      window.removeEventListener('touchstart', this._focusIdleReset);
      this._focusIdleReset = null;
    }
  }

  openFocusMode() {
    this.toggleFocusMode(true);
  }

  toggleFocusMode(active) {
    this.isFocusMode = active;
    const overlay = document.getElementById('focus-overlay');
    if (overlay) {
      overlay.classList.toggle('active', active);
    }
    if (active) {
      if (Player.currentTrack) {
        this.updateTrackInfo(Player.currentTrack);
      }
      this.updatePlayPauseIcons(Player.isPlaying);
      this.updateFavoriteButton();
      const focusDisc = document.getElementById('focus-cd-disc');
      if (focusDisc) {
        focusDisc.classList.toggle('spinning', Player.isPlaying);
        focusDisc.style.animationPlayState = Player.isPlaying ? 'running' : 'paused';
      }
      this.initFocusIdleTimer();
    } else {
      this.clearFocusIdleTimer();
    }
  }

  renderProfileView() {
    const container = document.getElementById('view-profile');
    if (!container) return;

    const displayName = this.getUserDisplayName();
    const avatar = this.getAvatarOrPlaceholder();
    const bio = this.getUserBio();
    const stats = this.getUserMusicStats();

    // Unified CD Collection
    const allCDs = CDCollection.getAll();

    const filter = this.collectionFilter || 'all';

    const filteredCDs = allCDs.filter(cd => {
      if (filter === 'radar') return cd.source === 'radar';
      if (filter === 'collection') return cd.source !== 'radar';
      return true;
    });

    let html = `
      <div class="view-header" style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
        <div>
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: var(--accent); margin-bottom: 4px;">
            Identidad Sonora & Estantería Personal
          </div>
          <h1 class="view-title" style="margin-bottom: 4px;">Mi Perfil Musical</h1>
          <p class="view-subtitle" style="margin-bottom: 0;">Tu espacio melómano, estadísticas de escucha y estantería digital de CDs.</p>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="profile-page-edit-btn" style="display: flex; align-items: center; gap: 6px; padding: 8px 14px; font-size: 12.5px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            Editar perfil
          </button>
          <button class="btn btn-primary" id="profile-page-share-btn" style="display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 12.5px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
              <polyline points="16 6 12 2 8 6"></polyline>
              <line x1="12" y1="2" x2="12" y2="15"></line>
            </svg>
            Compartir mi perfil
          </button>
        </div>
      </div>

      <!-- Profile Identity Card -->
      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 24px; margin-bottom: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
        <div class="profile-header-banner" style="margin-bottom: 0;">
          <div class="profile-avatar-large-wrapper" style="position: relative;">
            <img src="${avatar}" alt="${this.escapeHTML(displayName)}" class="profile-avatar-large" id="profile-page-avatar">
          </div>
          <div class="profile-meta-info" style="flex: 1;">
            <div class="profile-name-title" style="font-size: 24px; margin-bottom: 4px;">${this.escapeHTML(displayName)}</div>
            <div class="profile-bio-text" style="font-size: 13.5px; max-width: 600px; color: var(--text-secondary); line-height: 1.5;">${this.escapeHTML(bio)}</div>
            <div style="display: flex; gap: 16px; margin-top: 14px; font-size: 12px; color: var(--text-muted); flex-wrap: wrap;">
              <span><strong>${allCDs.length}</strong> CDs coleccionados</span>
              <span>•</span>
              <span><strong>${stats.songsCount}</strong> canciones exploradas</span>
              <span>•</span>
              <span>Sonido analógico activo</span>
            </div>
          </div>
        </div>

        <!-- Inline Edit Section -->
        <div id="profile-page-edit-form" style="display: none; background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 18px; margin-top: 20px;">
          <div style="font-size: 13px; font-weight: 600; margin-bottom: 12px; color: var(--text-primary);">Editar Información Personal</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 14px;">
            <div>
              <label style="font-size: 11.5px; color: var(--text-secondary); display: block; margin-bottom: 6px;">Nombre de usuario</label>
              <input type="text" id="edit-profile-page-name" class="modal-input" style="margin-bottom: 0; padding: 8px 12px; font-size: 13px;" value="${this.escapeHTML(displayName)}">
            </div>
            <div>
              <label style="font-size: 11.5px; color: var(--text-secondary); display: block; margin-bottom: 6px;">Biografía</label>
              <input type="text" id="edit-profile-page-bio" class="modal-input" style="margin-bottom: 0; padding: 8px 12px; font-size: 13px;" value="${this.escapeHTML(bio)}">
            </div>
          </div>
          <div style="margin-bottom: 14px;">
            <label style="font-size: 11.5px; color: var(--text-secondary); display: block; margin-bottom: 6px;">Foto de Perfil (Avatar)</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" id="edit-profile-page-avatar" class="modal-input" style="margin-bottom: 0; padding: 8px 12px; font-size: 13px; flex: 1;" placeholder="URL o sube una imagen..." value="${avatar.startsWith('data:') ? 'Imagen guardada localmente' : this.escapeHTML(avatar)}">
              <label class="btn btn-secondary" style="font-size: 12px; padding: 8px 14px; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; margin: 0;" title="Subir foto desde tu dispositivo">
                <input type="file" id="edit-profile-page-file-input" accept="image/*" style="display: none;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Subir desde PC
              </label>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn btn-secondary" id="edit-profile-page-cancel-btn" style="padding: 6px 14px; font-size: 12px;">Cancelar</button>
            <button class="btn btn-primary" id="edit-profile-page-save-btn" style="padding: 6px 16px; font-size: 12px;">Guardar cambios</button>
          </div>
        </div>
      </div>

      <!-- Stats Grid (Esta semana & Tu universo musical) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 32px;">
        <!-- Esta Semana -->
        <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 22px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); margin-bottom: 14px; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Esta semana
          </div>
          <div class="profile-stats-grid">
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.songsCount}</div>
              <div class="profile-stat-label">Canciones</div>
            </div>
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.artistsCount}</div>
              <div class="profile-stat-label">Artistas</div>
            </div>
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.albumsCount}</div>
              <div class="profile-stat-label">Álbumes</div>
            </div>
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.listenedTime}</div>
              <div class="profile-stat-label">Escuchadas</div>
            </div>
          </div>
        </div>

        <!-- Tu Universo Musical -->
        <div class="profile-universe-card" style="margin-bottom: 0;">
          <div class="profile-universe-title" style="margin-bottom: 14px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
              <path d="M2 12h20"></path>
            </svg>
            Tu universo musical
          </div>
          <div class="profile-universe-rows">
            <div class="universe-item">
              <div class="universe-item-label">Artista más escuchado</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.topArtist)}">${this.escapeHTML(stats.topArtist)}</div>
            </div>
            <div class="universe-item">
              <div class="universe-item-label">Canción más escuchada</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.topSong)}">${this.escapeHTML(stats.topSong)}</div>
            </div>
            <div class="universe-item">
              <div class="universe-item-label">Álbum de la semana</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.albumOfWeek)}">${this.escapeHTML(stats.albumOfWeek)}</div>
            </div>
            <div class="universe-item">
              <div class="universe-item-label">Género predominante</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.predominantGenre)}">${this.escapeHTML(stats.predominantGenre)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Link to Library & CD Shelf -->
      <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); padding: 22px 26px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;">
        <div>
          <div style="font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Tu Colección de CDs & Biblioteca</div>
          <div style="font-size: 13px; color: var(--text-secondary);">Tienes <strong>${allCDs.length}</strong> CDs en tu estantería digital y <strong>${stats.songsCount}</strong> pistas exploradas.</div>
        </div>
        <button class="btn btn-primary" id="profile-go-library-btn" style="padding: 9px 20px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Ver Estantería en Biblioteca
        </button>
      </div>
    </div>
    `;

    container.innerHTML = html;
    this.attachProfileEventListeners(container, stats);
    document.getElementById('profile-go-library-btn')?.addEventListener('click', () => this.showView('library'));
  }
  
  renderShelfCDItemHTML(cd, playlistId = null) {
    const isCurrent = Player.currentTrack && Player.currentTrack.id === cd.id;
    const cleanArtistName = this.cleanArtist(cd.artist);
    const removeTitle = playlistId ? 'Quitar de esta carpeta' : 'Quitar CD de la colección';
    const trackData = {
      id: cd.id,
      title: cd.trackTitle || cd.title,
      artist: cd.artist,
      thumbnail: cd.thumbnail,
      duration: cd.duration
    };

    return `
      <div class="shelf-cd-item ${isCurrent ? 'is-playing' : ''}" data-cd-id="${cd.id}" data-track-id="${cd.id}" data-track='${JSON.stringify(trackData).replace(/'/g, "&apos;")}' ${playlistId ? `data-playlist-id="${playlistId}"` : ''} title="${this.escapeHTML(cd.trackTitle || cd.title)} - ${this.escapeHTML(cleanArtistName)}">
        <div class="shelf-cd-case-3d">
          <div class="shelf-cd-case">
            <div class="cd-case-spine">
              <span class="spine-hinge spine-hinge-top"></span>
              <span class="spine-hinge spine-hinge-bottom"></span>
            </div>
            <img src="${cd.thumbnail}" alt="${this.escapeHTML(cd.title)}" loading="lazy" decoding="async" draggable="false">
            <div class="cd-case-glare"></div>
            <div class="cd-case-tab"></div>
          </div>
        </div>
        <div class="shelf-cd-meta">
          <div class="shelf-cd-title">${this.escapeHTML(cd.trackTitle || cd.title)}</div>
          <div class="shelf-cd-artist">${this.escapeHTML(cleanArtistName)}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 4px;">
            <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">${cd.duration || ''}</span>
            <button class="icon-btn shelf-cd-remove-btn" data-remove-id="${cd.id}" ${playlistId ? `data-playlist-id="${playlistId}"` : ''} title="${removeTitle}" style="width: 22px; height: 22px; opacity: 0.6; padding: 2px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindShelfItemListeners(container, list, playlistId, getHasDragged) {
    container.querySelectorAll('.shelf-cd-item:not([data-shelf-bound])').forEach(item => {
      item.setAttribute('data-shelf-bound', 'true');

      // Click to play
      item.addEventListener('click', (e) => {
        if (getHasDragged && getHasDragged()) return;
        if (e.target.closest('.shelf-cd-remove-btn')) return;

        const cdId = item.dataset.cdId;
        const foundIndex = list.findIndex(c => String(c.id) === String(cdId));
        if (foundIndex !== -1) {
          const playable = list.map(c => ({
            id: c.id,
            title: c.trackTitle || c.title,
            artist: c.artist,
            thumbnail: c.thumbnail,
            duration: c.duration
          }));
          Queue.setQueue(playable, foundIndex);
        }
      });

      // Right click context menu on shelf CD item
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cdId = item.dataset.cdId;
        const found = list.find(c => String(c.id) === String(cdId));
        if (found) {
          const track = {
            id: found.id,
            title: found.trackTitle || found.title,
            artist: found.artist,
            thumbnail: found.thumbnail,
            duration: found.duration
          };
          this.showContextMenu(e, track, playlistId);
        }
      });
    });

    // Remove CD from shelf button
    container.querySelectorAll('.shelf-cd-remove-btn:not([data-remove-bound])').forEach(btn => {
      btn.setAttribute('data-remove-bound', 'true');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cdId = btn.dataset.removeId;
        const fromPlId = btn.dataset.playlistId || playlistId;
        if (cdId) {
          if (fromPlId) {
            Playlists.removeSong(fromPlId, cdId);
            this.showToast('Tema retirado de la carpeta');
            this.renderPlaylistView(fromPlId);
          } else {
            CDCollection.removeCD(cdId);
            this.showToast('CD retirado de tu colección');
            this.updateFavoriteButton();
            if (this.currentView === 'library') this.renderLibraryView();
            if (this.currentView === 'profile') this.renderProfileView();
          }
        }
      });
    });
  }

  attachShelfEventListeners(container, cdList = null, playlistId = null) {
    const list = cdList || CDCollection.getAll();

    // Horizontal mouse drag-to-scroll on stage
    const shelfStage = container.querySelector('.cd-shelf-stage');
    if (shelfStage) {
      shelfStage.addEventListener('dragstart', (e) => e.preventDefault());
    }
    let hasDragged = false;

    if (shelfStage) {
      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;

      shelfStage.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDown = true;
        hasDragged = false;
        shelfStage.classList.add('is-dragging');
        startX = e.pageX - shelfStage.offsetLeft;
        scrollLeft = shelfStage.scrollLeft;
      });

      const onMouseUp = () => {
        if (!isDown) return;
        isDown = false;
        shelfStage.classList.remove('is-dragging');
        setTimeout(() => {
          hasDragged = false;
        }, 80);
      };

      window.addEventListener('mouseup', onMouseUp);

      shelfStage.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - shelfStage.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 4) {
          hasDragged = true;
        }
        shelfStage.scrollLeft = scrollLeft - walk;
      });

      // Mobile Touch drag support for Android
      shelfStage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isDown = true;
          hasDragged = false;
          startX = e.touches[0].pageX - shelfStage.offsetLeft;
          scrollLeft = shelfStage.scrollLeft;
        }
      }, { passive: true });

      shelfStage.addEventListener('touchmove', (e) => {
        if (!isDown || e.touches.length !== 1) return;
        const x = e.touches[0].pageX - shelfStage.offsetLeft;
        const walk = (x - startX) * 1.2;
        if (Math.abs(walk) > 6) {
          hasDragged = true;
        }
        shelfStage.scrollLeft = scrollLeft - walk;
      }, { passive: true });

      shelfStage.addEventListener('touchend', () => {
        if (!isDown) return;
        isDown = false;
        setTimeout(() => { hasDragged = false; }, 80);
      }, { passive: true });
    }

    // Bind item click and context menu listeners
    this.bindShelfItemListeners(container, list, playlistId, () => hasDragged);

    // Infinite scroll / progressive append if there are more than 36 items
    const grid = container.querySelector('.cd-shelf-grid');
    if (shelfStage && grid && list.length > 36) {
      let renderedCount = container.querySelectorAll('.shelf-cd-item').length;
      const onScroll = () => {
        if (renderedCount >= list.length) return;
        if (shelfStage.scrollLeft + shelfStage.clientWidth >= shelfStage.scrollWidth - 600) {
          const nextChunk = list.slice(renderedCount, renderedCount + 30);
          renderedCount += nextChunk.length;
          const temp = document.createElement('div');
          temp.innerHTML = nextChunk.map(t => this.renderShelfCDItemHTML(t, playlistId)).join('');
          while (temp.firstChild) {
            grid.appendChild(temp.firstChild);
          }
          this.bindShelfItemListeners(grid, list, playlistId, () => hasDragged);
        }
      };
      shelfStage.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  attachProfileEventListeners(container, stats) {
    // Edit form toggle
    const editBtn = document.getElementById('profile-page-edit-btn');
    const editForm = document.getElementById('profile-page-edit-form');
    const cancelBtn = document.getElementById('edit-profile-page-cancel-btn');
    const saveBtn = document.getElementById('edit-profile-page-save-btn');
    const fileInput = document.getElementById('edit-profile-page-file-input');
    const avatarInput = document.getElementById('edit-profile-page-avatar');

    if (editBtn && editForm) {
      editBtn.addEventListener('click', () => {
        editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (cancelBtn && editForm) {
      cancelBtn.addEventListener('click', () => {
        editForm.style.display = 'none';
      });
    }

    if (fileInput && avatarInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            this.showToast('La imagen es demasiado pesada (máx 5MB)');
            return;
          }
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            avatarInput.value = loadEvt.target.result;
            const preview = document.getElementById('profile-page-avatar');
            if (preview) preview.src = loadEvt.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const nameVal = document.getElementById('edit-profile-page-name')?.value.trim();
        const bioVal = document.getElementById('edit-profile-page-bio')?.value.trim();
        const avatarVal = avatarInput?.value.trim();

        if (nameVal) Config.setUsername(nameVal);
        if (bioVal !== undefined) Config.setBio(bioVal);
        if (avatarVal && !avatarVal.startsWith('Imagen guardada')) {
          Config.setAvatar(avatarVal);
        }

        this.renderUserBadge();
        this.showToast('Perfil actualizado');
        this.renderProfileView();
      });
    }

    // Share button
    document.getElementById('profile-page-share-btn')?.addEventListener('click', () => {
      this.openShareCardModal(stats || this.getUserMusicStats());
    });
  }

  openProfileModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    if (!modalBackdrop || !modalContent) return;

    const displayName = this.getUserDisplayName();
    const avatar = this.getAvatarOrPlaceholder();
    const bio = this.getUserBio();
    const stats = this.getUserMusicStats();

    modalContent.innerHTML = `
      <div class="modal-profile-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--accent);">Perfil de Melómano</div>
          <button class="icon-btn" id="modal-close-profile-btn" style="width: 28px; height: 28px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="profile-header-banner">
          <div class="profile-avatar-large-wrapper">
            <img src="${avatar}" alt="${this.escapeHTML(displayName)}" class="profile-avatar-large" id="profile-display-avatar">
          </div>
          <div class="profile-meta-info">
            <div class="profile-name-title" id="profile-display-name">${this.escapeHTML(displayName)}</div>
            <div class="profile-bio-text" id="profile-display-bio">${this.escapeHTML(bio)}</div>
            <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
              <button class="btn btn-secondary" id="profile-edit-btn" style="padding: 4px 10px; font-size: 11.5px;">Editar perfil</button>
              <button class="btn btn-primary" id="profile-share-btn" style="padding: 4px 12px; font-size: 11.5px; display: flex; align-items: center; gap: 6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                  <polyline points="16 6 12 2 8 6"></polyline>
                  <line x1="12" y1="2" x2="12" y2="15"></line>
                </svg>
                Compartir mi perfil
              </button>
            </div>
          </div>
        </div>

        <!-- Inline Edit Section -->
        <div id="profile-edit-form" style="display: none; background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 10px; color: var(--text-primary);">Editar Información</div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div>
              <label style="font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Nombre de usuario</label>
              <input type="text" id="edit-profile-name" class="modal-input" style="margin-bottom: 0; padding: 7px 10px; font-size: 12.5px;" value="${this.escapeHTML(displayName)}">
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Biografía</label>
              <input type="text" id="edit-profile-bio" class="modal-input" style="margin-bottom: 0; padding: 7px 10px; font-size: 12.5px;" value="${this.escapeHTML(bio)}">
            </div>
            <div>
              <label style="font-size: 11px; color: var(--text-secondary); display: block; margin-bottom: 4px;">Avatar (URL o subir archivo local)</label>
              <div style="display: flex; gap: 6px;">
                <input type="text" id="edit-profile-avatar" class="modal-input" style="margin-bottom: 0; padding: 7px 10px; font-size: 12.5px; flex: 1;" placeholder="https://..." value="${this.escapeHTML(Config.getAvatar())}">
                <button class="btn btn-secondary" id="edit-profile-file-btn" style="padding: 4px 10px; font-size: 11.5px; white-space: nowrap;">Subir archivo</button>
                <input type="file" id="edit-profile-file-input" accept="image/*" style="display: none;">
              </div>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
              <button class="btn btn-secondary" id="edit-profile-cancel-btn" style="padding: 4px 10px; font-size: 11.5px;">Cancelar</button>
              <button class="btn btn-primary" id="edit-profile-save-btn" style="padding: 4px 12px; font-size: 11.5px;">Guardar cambios</button>
            </div>
          </div>
        </div>

        <!-- Esta Semana -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-secondary); margin-bottom: 10px;">Esta semana</div>
          <div class="profile-stats-grid">
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.songsCount}</div>
              <div class="profile-stat-label">Canciones</div>
            </div>
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.artistsCount}</div>
              <div class="profile-stat-label">Artistas</div>
            </div>
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.albumsCount}</div>
              <div class="profile-stat-label">Álbumes</div>
            </div>
            <div class="profile-stat-box">
              <div class="profile-stat-number">${stats.listenedTime}</div>
              <div class="profile-stat-label">Escuchadas</div>
            </div>
          </div>
        </div>

        <!-- Tu Universo Musical -->
        <div class="profile-universe-card">
          <div class="profile-universe-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
              <path d="M2 12h20"></path>
            </svg>
            Tu universo musical
          </div>
          <div class="profile-universe-rows">
            <div class="universe-item">
              <div class="universe-item-label">Artista más escuchado</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.topArtist)}">${this.escapeHTML(stats.topArtist)}</div>
            </div>
            <div class="universe-item">
              <div class="universe-item-label">Canción más escuchada</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.topSong)}">${this.escapeHTML(stats.topSong)}</div>
            </div>
            <div class="universe-item">
              <div class="universe-item-label">Álbum de la semana</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.albumOfWeek)}">${this.escapeHTML(stats.albumOfWeek)}</div>
            </div>
            <div class="universe-item">
              <div class="universe-item-label">Género predominante</div>
              <div class="universe-item-value" title="${this.escapeHTML(stats.predominantGenre)}">${this.escapeHTML(stats.predominantGenre)}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    modalBackdrop.classList.add('open');

    document.getElementById('modal-close-profile-btn')?.addEventListener('click', () => this.closeModal());

    const editBtn = document.getElementById('profile-edit-btn');
    const editForm = document.getElementById('profile-edit-form');
    const cancelEditBtn = document.getElementById('edit-profile-cancel-btn');
    const saveEditBtn = document.getElementById('edit-profile-save-btn');
    const fileBtn = document.getElementById('edit-profile-file-btn');
    const fileInput = document.getElementById('edit-profile-file-input');

    if (editBtn && editForm) {
      editBtn.addEventListener('click', () => {
        editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (cancelEditBtn && editForm) {
      cancelEditBtn.addEventListener('click', () => {
        editForm.style.display = 'none';
      });
    }

    if (fileBtn && fileInput) {
      fileBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            const base64 = loadEvt.target.result;
            const avatarInput = document.getElementById('edit-profile-avatar');
            if (avatarInput) avatarInput.value = base64;
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (saveEditBtn) {
      saveEditBtn.addEventListener('click', () => {
        const nameVal = document.getElementById('edit-profile-name')?.value.trim();
        const bioVal = document.getElementById('edit-profile-bio')?.value.trim();
        const avatarVal = document.getElementById('edit-profile-avatar')?.value.trim();

        if (nameVal) Config.setUsername(nameVal);
        if (bioVal !== undefined) Config.setBio(bioVal);
        if (avatarVal !== undefined) Config.setAvatar(avatarVal);

        this.renderUserBadge();
        this.showToast('Perfil actualizado');
        this.openProfileModal();
      });
    }

    const shareBtn = document.getElementById('profile-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.openShareCardModal(stats);
      });
    }
  }

  openShareCardModal(stats) {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    if (!modalBackdrop || !modalContent) return;

    const displayName = this.getUserDisplayName();
    const avatar = this.getAvatarOrPlaceholder();
    const bio = this.getUserBio();
    const collectionCDs = CDCollection.getAll().slice(0, 4);

    let activeFormat = 'story'; // 'story' (9:16) or 'square' (1:1)

    modalContent.innerHTML = `
      <div class="modal-profile-card share-card-container">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div>
            <h2 class="modal-title" style="margin-bottom: 2px;">Tarjeta para Redes</h2>
            <p style="font-size: 12px; color: var(--text-secondary); margin: 0;">Diseñada para compartir tu universo sonoro.</p>
          </div>
          <button class="icon-btn" id="modal-close-share-btn" style="width: 28px; height: 28px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Format Switcher: 9:16 Story vs 1:1 Square -->
        <div class="share-format-toggle">
          <button class="share-format-btn active" id="share-fmt-story">Instagram Story (9:16)</button>
          <button class="share-format-btn" id="share-fmt-square">Cuadrado (1:1)</button>
        </div>

        <canvas id="profile-share-canvas" width="720" height="1280" class="share-card-canvas-preview"></canvas>

        <div style="display: flex; gap: 10px; width: 100%; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="share-back-btn" style="padding: 9px 16px; font-size: 13px;">Cerrar</button>
          <button class="btn btn-secondary" id="share-copy-btn" style="padding: 9px 16px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copiar Imagen
          </button>
          <button class="btn btn-primary" id="share-download-btn" style="padding: 9px 18px; font-size: 13px; display: flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Descargar Tarjeta (PNG)
          </button>
        </div>
      </div>
    `;

    modalBackdrop.classList.add('open');

    document.getElementById('modal-close-share-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('share-back-btn')?.addEventListener('click', () => this.closeModal());

    const canvas = document.getElementById('profile-share-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let loadedAvatarImg = null;

    const drawCard = () => {
      const isStory = activeFormat === 'story';
      const W = isStory ? 720 : 800;
      const H = isStory ? 1280 : 800;
      canvas.width = W;
      canvas.height = H;

      // 1. Deep luxury background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#07070a');
      bgGrad.addColorStop(0.3, '#101018');
      bgGrad.addColorStop(0.7, '#14141e');
      bgGrad.addColorStop(1, '#08080c');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // 2. Concentric vinyl grooves
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.022)';
      ctx.lineWidth = 1;
      const arcCenterX = isStory ? 640 : 700;
      const arcCenterY = isStory ? 220 : 180;
      for (let r = 80; r <= 800; r += 22) {
        ctx.beginPath();
        ctx.arc(arcCenterX, arcCenterY, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Top branding: BluxWave badge
      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      ctx.arc(56, 56, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(56, 56, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('BluxWave', 84, 63);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('SONIDO PURO & COLECCIÓN', W - 56, 63);
      ctx.textAlign = 'left';

      // 4. User Avatar & Info
      const avatarX = 56;
      const avatarY = isStory ? 106 : 94;
      const avatarR = isStory ? 44 : 38;

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      if (loadedAvatarImg) {
        ctx.drawImage(loadedAvatarImg, avatarX, avatarY, avatarR * 2, avatarR * 2);
      } else {
        ctx.fillStyle = '#22222a';
        ctx.fillRect(avatarX, avatarY, avatarR * 2, avatarR * 2);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${avatarR * 0.8}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayName.charAt(0).toUpperCase(), avatarX + avatarR, avatarY + avatarR);
      }
      ctx.restore();

      // Avatar border ring
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(avatarX + avatarR, avatarY + avatarR, avatarR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Display name & bio
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#ffffff';
      ctx.font = isStory ? 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(displayName, avatarX + avatarR * 2 + 18, avatarY + (isStory ? 40 : 34));

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = isStory ? '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' : '12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const cleanBio = bio.length > 55 ? bio.slice(0, 52) + '...' : bio;
      ctx.fillText(cleanBio, avatarX + avatarR * 2 + 18, avatarY + (isStory ? 70 : 60));

      if (isStory) {
        // ========== 9:16 STORY LAYOUT ==========

        // 5. Section: "ESTA SEMANA"
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('ESTA SEMANA', 56, 240);

        const statBoxes = [
          { label: 'CANCIONES', value: stats.songsCount },
          { label: 'ARTISTAS', value: stats.artistsCount },
          { label: 'ÁLBUMES', value: stats.albumsCount },
          { label: 'ESCUCHADAS', value: stats.listenedTime }
        ];

        const boxWidth = 142;
        const boxHeight = 84;
        const startX = 56;
        const gap = 13;

        statBoxes.forEach((item, i) => {
          const bx = startX + i * (boxWidth + gap);
          const by = 258;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.beginPath();
          ctx.roundRect(bx, by, boxWidth, boxHeight, 10);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(item.value), bx + boxWidth / 2, by + 44);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(item.label, bx + boxWidth / 2, by + 68);
        });

        // 6. Section: "TU UNIVERSO MUSICAL"
        ctx.textAlign = 'left';
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('TU UNIVERSO MUSICAL', 56, 395);

        const universeItems = [
          { label: 'ARTISTA MÁS ESCUCHADO', value: stats.topArtist },
          { label: 'CANCIÓN MÁS ESCUCHADA', value: stats.topSong },
          { label: 'ÁLBUM DE LA SEMANA', value: stats.albumOfWeek },
          { label: 'GÉNERO PREDOMINANTE', value: stats.predominantGenre }
        ];

        universeItems.forEach((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const uX = 56 + col * (290 + 28);
          const uY = 415 + row * (100 + 14);
          const uW = 290;
          const uH = 100;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.beginPath();
          ctx.roundRect(uX, uY, uW, uH, 12);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(item.label, uX + 18, uY + 34);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const valText = item.value.length > 22 ? item.value.slice(0, 20) + '...' : item.value;
          ctx.fillText(valText, uX + 18, uY + 68);
        });

        // 7. Section: "COLECCIÓN DE CDs" Showcase
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('ESTANTERÍA DE CDs COLECCIONADOS', 56, 680);

        const cdRowY = 705;
        const cdW = 135;
        const cdH = 135;
        const cdGap = 22;

        collectionCDs.forEach((cd, i) => {
          const cx = 56 + i * (cdW + cdGap);
          if (cx + cdW > W - 40) return;

          // CD Case Base
          ctx.fillStyle = '#14141a';
          ctx.beginPath();
          ctx.roundRect(cx, cdRowY, cdW, cdH, 6);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Vinyl Disc Peek
          const discR = 48;
          const discX = cx + cdW - 12;
          const discY = cdRowY + cdH / 2;

          ctx.save();
          ctx.beginPath();
          ctx.arc(discX, discY, discR, 0, Math.PI * 2);
          ctx.fillStyle = '#0c0c10';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = 1;
          ctx.stroke();

          // Disc grooves
          for (let r = 18; r < discR; r += 7) {
            ctx.beginPath();
            ctx.arc(discX, discY, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.stroke();
          }

          // Disc Center Hole
          ctx.beginPath();
          ctx.arc(discX, discY, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#07070a';
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // CD Title & Artist below case
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const tText = cd.title.length > 14 ? cd.title.slice(0, 12) + '...' : cd.title;
          ctx.fillText(tText, cx, cdRowY + cdH + 20);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = '10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const aText = cd.artist.length > 16 ? cd.artist.slice(0, 14) + '...' : cd.artist;
          ctx.fillText(aText, cx, cdRowY + cdH + 36);
        });

        // 8. Visual Vinyl Centerpiece
        const centerDiscY = 1060;
        const centerDiscX = W / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerDiscX, centerDiscY, 68, 0, Math.PI * 2);
        ctx.fillStyle = '#111116';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (let r = 26; r < 68; r += 8) {
          ctx.beginPath();
          ctx.arc(centerDiscX, centerDiscY, r, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(centerDiscX, centerDiscY, 18, 0, Math.PI * 2);
        ctx.fillStyle = '#07070a';
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 9. Footer Tagline
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Colección y reproducción auténtica • BluxWave', W / 2, 1220);

      } else {
        // ========== 1:1 SQUARE LAYOUT ==========

        // 5. Section: "ESTA SEMANA"
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('ESTA SEMANA', 56, 195);

        const statBoxes = [
          { label: 'CANCIONES', value: stats.songsCount },
          { label: 'ARTISTAS', value: stats.artistsCount },
          { label: 'ÁLBUMES', value: stats.albumsCount },
          { label: 'ESCUCHADAS', value: stats.listenedTime }
        ];

        const boxWidth = 160;
        const boxHeight = 72;
        const startX = 56;
        const gap = 16;

        statBoxes.forEach((item, i) => {
          const bx = startX + i * (boxWidth + gap);
          const by = 210;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.beginPath();
          ctx.roundRect(bx, by, boxWidth, boxHeight, 8);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(String(item.value), bx + boxWidth / 2, by + 38);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(item.label, bx + boxWidth / 2, by + 58);
        });

        // 6. Section: "TU UNIVERSO MUSICAL"
        ctx.textAlign = 'left';
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('TU UNIVERSO MUSICAL', 56, 325);

        const universeItems = [
          { label: 'ARTISTA MÁS ESCUCHADO', value: stats.topArtist },
          { label: 'CANCIÓN MÁS ESCUCHADA', value: stats.topSong },
          { label: 'ÁLBUM DE LA SEMANA', value: stats.albumOfWeek },
          { label: 'GÉNERO PREDOMINANTE', value: stats.predominantGenre }
        ];

        universeItems.forEach((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const uX = 56 + col * (330 + 28);
          const uY = 345 + row * (88 + 14);
          const uW = 330;
          const uH = 88;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.beginPath();
          ctx.roundRect(uX, uY, uW, uH, 10);
          ctx.fill();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(item.label, uX + 16, uY + 30);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const valText = item.value.length > 25 ? item.value.slice(0, 23) + '...' : item.value;
          ctx.fillText(valText, uX + 16, uY + 60);
        });

        // 7. Visual Mini CD Shelf Bar
        ctx.fillStyle = '#818cf8';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('DISCOS EN COLECCIÓN', 56, 575);

        const shelfY = 595;
        collectionCDs.slice(0, 4).forEach((cd, i) => {
          const sX = 56 + i * (158 + 18);
          if (sX + 158 > W - 40) return;

          ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
          ctx.beginPath();
          ctx.roundRect(sX, shelfY, 158, 62, 8);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.stroke();

          // Mini CD icon
          ctx.save();
          ctx.beginPath();
          ctx.arc(sX + 28, shelfY + 31, 18, 0, Math.PI * 2);
          ctx.fillStyle = '#111116';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sX + 28, shelfY + 31, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#07070a';
          ctx.fill();
          ctx.restore();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const titleShort = cd.title.length > 13 ? cd.title.slice(0, 11) + '...' : cd.title;
          ctx.fillText(titleShort, sX + 54, shelfY + 28);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          const artistShort = cd.artist.length > 14 ? cd.artist.slice(0, 12) + '...' : cd.artist;
          ctx.fillText(artistShort, sX + 54, shelfY + 46);
        });

        // 8. Footer Tagline
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Colección y reproducción auténtica • BluxWave', W / 2, 755);
      }
    };

    // Load avatar safely with crossOrigin anonymous and fallback
    if (avatar && (avatar.startsWith('data:') || avatar.startsWith('blob:'))) {
      const img = new Image();
      img.onload = () => { loadedAvatarImg = img; drawCard(); };
      img.onerror = () => { loadedAvatarImg = null; drawCard(); };
      img.src = avatar;
    } else if (avatar) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedAvatarImg = img;
        try { drawCard(); } catch { loadedAvatarImg = null; drawCard(); }
      };
      img.onerror = () => { loadedAvatarImg = null; drawCard(); };
      img.src = avatar;
    } else {
      drawCard();
    }

    // Format buttons
    const storyBtn = document.getElementById('share-fmt-story');
    const squareBtn = document.getElementById('share-fmt-square');

    if (storyBtn && squareBtn) {
      storyBtn.addEventListener('click', () => {
        activeFormat = 'story';
        storyBtn.classList.add('active');
        squareBtn.classList.remove('active');
        drawCard();
      });

      squareBtn.addEventListener('click', () => {
        activeFormat = 'square';
        squareBtn.classList.add('active');
        storyBtn.classList.remove('active');
        drawCard();
      });
    }

    // Share buttons handlers
    const copyBtn = document.getElementById('share-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        try {
          canvas.toBlob((blob) => {
            if (blob && navigator.clipboard && window.ClipboardItem) {
              navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                .then(() => this.showToast('Tarjeta copiada al portapapeles'))
                .catch(() => this.showToast('Copia no soportada en este entorno. Usa Descargar.'));
            } else {
              this.showToast('Descarga la tarjeta como PNG para compartir.');
            }
          });
        } catch {
          this.showToast('Descarga la tarjeta como PNG para compartir.');
        }
      });
    }

    const downloadBtn = document.getElementById('share-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.download = `bluxwave-perfil-${activeFormat}-${displayName.toLowerCase().replace(/\s+/g, '-')}.png`;
          a.href = dataUrl;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          this.showToast('Tarjeta descargada correctamente');
        } catch {
          this.showToast('No se pudo descargar la imagen.');
        }
      });
    }
  }

  openCreatePlaylistModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    if (!modalBackdrop || !modalContent) return;

    modalContent.innerHTML = `
      <h2 class="modal-title">Crear nueva Carpeta</h2>
      <input type="text" id="new-playlist-name-input" class="modal-input" placeholder="Nombre de la carpeta..." autofocus>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel-btn">Cancelar</button>
        <button class="btn btn-primary" id="modal-confirm-create-pl-btn">Crear</button>
      </div>
    `;

    modalBackdrop.classList.add('open');

    const input = document.getElementById('new-playlist-name-input');
    const confirmBtn = document.getElementById('modal-confirm-create-pl-btn');
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && confirmBtn) confirmBtn.click();
      });
    }

    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const val = input.value.trim();
        if (val) {
          const pl = Playlists.create(val);
          this.closeModal();
          this.showToast(`Carpeta "${pl.name}" creada`);
          this.renderPlaylistView(pl.id);
        }
      });
    }
  }

  openSongActionsModal(track, fromPlaylistId = null) {
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalContent = document.getElementById('modal-content');
    if (!modalBackdrop || !modalContent) return;

    const playlists = Playlists.getAll();
    const hasCD = CDCollection.hasCD(track.id);

    modalContent.innerHTML = `
      <h2 class="modal-title" style="font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.title}</h2>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px;">
        <button class="btn btn-secondary" id="action-queue-next" style="text-align: left; padding: 10px 14px;">Reproducir siguiente en fila</button>
        <button class="btn btn-secondary" id="action-toggle-cd" style="text-align: left; padding: 10px 14px;">${hasCD ? 'Quitar CD de mi colección' : 'Quedarme este CD (Colección)'}</button>
        ${fromPlaylistId ? `<button class="btn btn-secondary" id="action-remove-from-pl" style="text-align: left; padding: 10px 14px; color: var(--danger);">Quitar de esta carpeta</button>` : ''}
        
        <div style="margin-top: 10px; font-size: 13px; color: var(--text-secondary); font-weight: 500;">Añadir a una Carpeta:</div>
        ${playlists.length === 0 ? `<div style="font-size: 12px; color: var(--text-muted);">No tienes carpetas en tu colección.</div>` : `
          <div style="max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
            ${playlists.map(pl => `
              <button class="btn btn-secondary action-add-to-pl-btn" data-pl-id="${pl.id}" style="text-align: left; font-size: 12.5px; padding: 8px 12px;">+ ${pl.name}</button>
            `).join('')}
          </div>
        `}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="modal-cancel-btn">Cerrar</button>
      </div>
    `;

    modalBackdrop.classList.add('open');

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => this.closeModal());

    document.getElementById('action-queue-next')?.addEventListener('click', () => {
      Queue.addNext(track);
      this.closeModal();
      this.showToast('Añadido para reproducir siguiente');
    });

    document.getElementById('action-toggle-cd')?.addEventListener('click', () => {
      const added = CDCollection.toggleCD(track, {
        album: track.title,
        genre: 'CD'
      });
      this.closeModal();
      this.showToast(added ? `¡Te quedaste el CD! Sumado a tu colección` : `CD retirado de tu colección`);
      this.updateFavoriteButton();
      if (this.currentView === 'profile') this.renderProfileView();
      if (this.currentView === 'library') this.renderLibraryView();
    });

    if (fromPlaylistId) {
      document.getElementById('action-remove-from-pl')?.addEventListener('click', () => {
        Playlists.removeSong(fromPlaylistId, track.id);
        this.closeModal();
        this.showToast('Eliminada de la carpeta');
      });
    }

    modalContent.querySelectorAll('.action-add-to-pl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const plId = btn.dataset.plId;
        const pl = Playlists.getById(plId);
        const added = Playlists.addSong(plId, track);
        this.closeModal();
        if (added) {
          this.showToast(`Añadida a "${pl.name}"`);
        } else {
          this.showToast(`Ya estaba en "${pl.name}"`);
        }
      });
    });
  }

  closeModal() {
    const modalBackdrop = document.getElementById('modal-backdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('open');
  }
}

export const UI = new UIController();
