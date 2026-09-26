/**
 * player.js - YouTube Official IFrame Player Controller
 */

import { Config } from './config.js';
import { ColorExtractor } from './color.js';

class PlayerController {
  constructor() {
    this.player = null;
    this.isReady = false;
    this.currentTrack = null;
    this.pendingTrack = null;
    this.isPlaying = false;
    this.duration = 0;
    this.currentTime = 0;
    this.volume = Config.get('volume') ?? 80;
    this.progressInterval = null;

    // Event listeners
    this.listeners = {
      stateChange: [],
      timeUpdate: [],
      trackChange: [],
      error: [],
      trackEnd: []
    };

    this.init();
  }

  init() {
    // Check if YouTube API is already loaded
    if (!window.YT || !window.YT.Player) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        this.createPlayer();
      };
    } else {
      this.createPlayer();
    }
  }

  createPlayer() {
    const frameEl = document.getElementById('yt-player-frame');
    if (!frameEl) return;

    this.player = new window.YT.Player('yt-player-frame', {
      height: '100%',
      width: '100%',
      host: 'https://www.youtube-nocookie.com',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1,
        origin: window.location.origin && window.location.origin.startsWith('http') ? window.location.origin : undefined
      },
      events: {
        onReady: (event) => {
          this.isReady = true;
          this.player.setVolume(this.volume);
          console.log('[Player] YouTube IFrame API Ready');

          if (this.pendingTrack) {
            const track = this.pendingTrack;
            this.pendingTrack = null;
            this.loadTrack(track, true);
          }
        },
        onStateChange: (event) => {
          this.handleStateChange(event.data);
        },
        onError: (event) => {
          console.warn('[Player] YouTube Player error code:', event.data);
          this.emit('error', event.data);
          if ([2, 5, 100, 101, 150].includes(event.data)) {
            this.emit('unplayable', { track: this.currentTrack, code: event.data });
          }
        }
      }
    });
  }

  handleStateChange(state) {
    // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
    if (state === 1) { // PLAYING
      this.isPlaying = true;
      this.startProgressTimer();
      this.emit('stateChange', { isPlaying: true, state });
    } else if (state === 2) { // PAUSED
      this.isPlaying = false;
      this.stopProgressTimer();
      this.emit('stateChange', { isPlaying: false, state });
    } else if (state === 0) { // ENDED
      this.isPlaying = false;
      this.stopProgressTimer();
      this.emit('stateChange', { isPlaying: false, state });
      this.emit('trackEnd', this.currentTrack);
    } else if (state === 3) { // BUFFERING
      // Keep UI responsive during buffering
    }
  }

  startProgressTimer() {
    this.stopProgressTimer();

    const tick = () => {
      if (this.player && this.isPlaying && typeof this.player.getCurrentTime === 'function') {
        try {
          this.currentTime = this.player.getCurrentTime() || 0;
          this.duration = this.player.getDuration() || this.duration || 0;
          this.emit('timeUpdate', {
            currentTime: this.currentTime,
            duration: this.duration,
            progress: this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
          });
        } catch {
          // Player not ready
        }
      }
    };

    // 300ms foreground for smooth slider, 1000ms when document is hidden (background / screen-off)
    const interval = typeof document !== 'undefined' && document.hidden ? 1000 : 300;
    this.progressInterval = setInterval(tick, interval);

    if (typeof document !== 'undefined' && !this._visibilityBound) {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (this.isPlaying) {
          this.startProgressTimer();
        }
      });
    }
  }

  stopProgressTimer() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  loadTrack(track, autoPlay = true) {
    if (!track || !track.id) return;
    this.currentTrack = track;

    try {
      this.emit('trackChange', track);
    } catch (e) {
      console.warn('[Player] Error in trackChange listener:', e);
    }

    // Apply ambient dynamic color based on track thumbnail
    try {
      ColorExtractor.getDominantColor(track.thumbnail).then(color => {
        ColorExtractor.applyAmbientColor(color);
      }).catch(() => {});
    } catch (e) {}

    if (!this.isReady || !this.player || typeof this.player.loadVideoById !== 'function') {
      this.pendingTrack = track;
      return;
    }

    let videoId = String(track.id).trim();
    if (videoId.includes('v=')) {
      videoId = videoId.split('v=')[1].split('&')[0];
    } else if (videoId.includes('youtu.be/')) {
      videoId = videoId.split('youtu.be/')[1].split('?')[0];
    }

    try {
      if (autoPlay) {
        this.player.loadVideoById({
          videoId: videoId,
          startSeconds: 0
        });
      } else {
        this.player.cueVideoById({
          videoId: videoId,
          startSeconds: 0
        });
      }
    } catch (err) {
      console.error('[Player] Error loading video:', err);
    }
  }

  play() {
    if (this.player && typeof this.player.playVideo === 'function') {
      try {
        this.player.playVideo();
      } catch (e) {
        console.warn('[Player] playVideo failed:', e);
      }
    }
  }

  pause() {
    if (this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch (e) {
        console.warn('[Player] pauseVideo failed:', e);
      }
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seekTo(seconds) {
    if (this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(seconds, true);
        this.currentTime = seconds;
      } catch (e) {
        console.warn('[Player] seekTo failed:', e);
      }
    }
  }

  seekBy(delta) {
    const newTime = Math.max(0, Math.min(this.duration, this.currentTime + delta));
    this.seekTo(newTime);
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(100, volume));
    Config.set('volume', this.volume);
    if (this.player && typeof this.player.setVolume === 'function') {
      try {
        this.player.setVolume(this.volume);
      } catch (e) {}
    }
  }

  changeVolume(delta) {
    this.setVolume(this.volume + delta);
    return this.volume;
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.warn(`[Player] Error in '${event}' event listener:`, e);
        }
      });
    }
  }
}

export const Player = new PlayerController();
