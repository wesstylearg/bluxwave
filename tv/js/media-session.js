/**
 * media-session.js - MediaSession API Integration for Android TV & Google TV
 * 
 * Exposes real playback state, track metadata and hardware remote controls
 * to Android OS MediaSession / Google TV launcher.
 */

import { Player } from './player.js';
import { Queue } from './queue.js';

export class MediaSessionManager {
  static init() {
    if (!('mediaSession' in navigator)) {
      console.log('[MediaSession] Not supported on this platform');
      return;
    }

    this.setupActionHandlers();
    this.subscribeToPlayerEvents();
    console.log('[MediaSession] Initialized for Android TV');
  }

  static setupActionHandlers() {
    const actions = [
      ['play', () => Player.play()],
      ['pause', () => Player.pause()],
      ['previoustrack', () => Queue.prev()],
      ['nexttrack', () => Queue.next()],
      ['stop', () => Player.pause()],
      ['seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          Player.seekTo(details.seekTime);
        }
      }],
      ['seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        Player.seekBy(-offset);
      }],
      ['seekforward', (details) => {
        const offset = details.seekOffset || 10;
        Player.seekBy(offset);
      }]
    ];

    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {
        // Unsupported action in some browser/OS versions
      }
    }
  }

  static subscribeToPlayerEvents() {
    // 1. Track changed: Update title, artist, album, artwork
    Player.on('trackChange', (track) => {
      this.updateMetadata(track);
    });

    // 2. Playback state changed (playing / paused)
    Player.on('stateChange', ({ isPlaying }) => {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      } catch (e) {}
      this.updatePositionState();
    });

    // 3. Time update: Update position state periodically
    Player.on('timeUpdate', () => {
      this.updatePositionState();
    });
  }

  static updateMetadata(track) {
    if (!track || !('mediaSession' in navigator)) return;

    try {
      const artwork = [];
      if (track.thumbnail) {
        artwork.push(
          { src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '192x192', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title || 'BluxWave',
        artist: track.artist || 'BluxWave TV',
        album: track.album || 'BluxWave Music',
        artwork: artwork
      });
    } catch (e) {
      console.warn('[MediaSession] Could not set metadata:', e);
    }
  }

  static updatePositionState() {
    if (!('mediaSession' in navigator) || typeof navigator.mediaSession.setPositionState !== 'function') {
      return;
    }

    try {
      const duration = Player.duration || 0;
      const position = Player.currentTime || 0;

      if (duration > 0 && position >= 0 && position <= duration) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: position
        });
      }
    } catch (e) {
      // Ignore transient position sync errors
    }
  }
}
