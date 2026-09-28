/**
 * media-session.js - MediaSession API for BLUXWAVE LITE
 */

import { Player } from './player.js';
import { Queue } from './queue.js';
import { CastManager } from './cast.js';

export class MediaSessionManager {
  static init() {
    if (!('mediaSession' in navigator)) return;

    this.setupActionHandlers();
    this.subscribeToEvents();
  }

  static setupActionHandlers() {
    const actions = [
      ['play', () => {
        if (CastManager.isConnected) CastManager.resume();
        else Player.play();
      }],
      ['pause', () => {
        if (CastManager.isConnected) CastManager.pause();
        else Player.pause();
      }],
      ['previoustrack', () => {
        if (CastManager.isConnected) CastManager.previous();
        else Queue.prev();
      }],
      ['nexttrack', () => {
        if (CastManager.isConnected) CastManager.next();
        else Queue.next();
      }],
      ['seekto', (details) => {
        if (details.seekTime !== undefined) {
          if (CastManager.isConnected) CastManager.seekTo(details.seekTime);
          else Player.seekTo(details.seekTime);
        }
      }]
    ];

    for (const [action, handler] of actions) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {}
    }
  }

  static subscribeToEvents() {
    Player.on('trackChange', (track) => {
      if (!CastManager.isConnected) this.updateMetadata(track);
    });

    Player.on('stateChange', ({ isPlaying }) => {
      if (!CastManager.isConnected) {
        try {
          navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        } catch (e) {}
      }
    });

    CastManager.on('stateUpdate', (state) => {
      if (CastManager.isConnected && state.currentTrack) {
        this.updateMetadata(state.currentTrack);
        try {
          navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
        } catch (e) {}
      }
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
          { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: track.title || 'BluxWave',
        artist: track.artist || 'BluxWave Lite',
        album: track.album || 'BluxWave Music',
        artwork: artwork
      });
    } catch (e) {}
  }
}
