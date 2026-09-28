/**
 * app.js - Main Application Bootstrap for BluxWave
 */

import { UI } from './ui.js';
import { Player } from './player.js';
import { Queue } from './queue.js';
import { Auth } from './auth.js';
import { CloudSync } from './sync.js';
import { CURATED_TRACKS } from './youtube.js';
import { SpatialNavigator } from './spatial-nav.js';
import { MediaSessionManager } from './media-session.js';
import { CastReceiverManager } from './cast-receiver.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('[BluxWave] Initializing Android TV 10-foot player with Cast Receiver...');

  // Expose on window for handlers
  window.bluxUI = UI;
  window.bluxPlayer = Player;
  window.bluxQueue = Queue;
  window.bluxAuth = Auth;
  window.bluxCloudSync = CloudSync;

  // Initialize Auth, CloudSync, MediaSession, Cast Receiver & UI
  Auth.init();
  CloudSync.init();
  MediaSessionManager.init();
  CastReceiverManager.init();
  UI.init();

  // Initialize Spatial Navigation for Android TV D-Pad Remote
  const nav = new SpatialNavigator({
    onIdle: () => {
      // Auto-enter Ambient TV mode after 10s of inactivity if playing
      if (Player.isPlaying && !UI.isAmbientActive) {
        UI.openAmbientMode();
      }
    }
  });
  nav.init();
  window.bluxNav = nav;

  // TV Ambient and modal event listeners
  window.addEventListener('tv-ambient-show-queue', () => UI.toggleAmbientQueue(true));
  window.addEventListener('tv-ambient-hide-queue', () => UI.toggleAmbientQueue(false));
  window.addEventListener('tv-exit-ambient', () => UI.closeAmbientMode());
  window.addEventListener('tv-close-modal', () => UI.closeModal());

  // If no track is in queue, preload the first curated track without autoplay
  if (Queue.tracks.length === 0) {
    const firstTrack = CURATED_TRACKS[0];
    Queue.tracks = [firstTrack];
    Queue.currentIndex = 0;
    Queue.save();
    UI.updateTrackInfo(firstTrack);
  } else {
    const current = Queue.getCurrentTrack();
    if (current) {
      UI.updateTrackInfo(current);
    }
  }

  // Centralized Lifecycle & Resource Suspension Manager
  const onVisibilityChange = () => {
    if (document.hidden) {
      document.body.classList.add('app-suspended');
      Player.stopProgressTimer();
    } else {
      document.body.classList.remove('app-suspended');
      if (Player.isPlaying) {
        if (Player.player && typeof Player.player.getCurrentTime === 'function') {
          try {
            Player.currentTime = Player.player.getCurrentTime() || 0;
            Player.duration = Player.player.getDuration() || Player.duration || 0;
            Player.emit('timeUpdate', {
              currentTime: Player.currentTime,
              duration: Player.duration,
              progress: Player.duration > 0 ? (Player.currentTime / Player.duration) * 100 : 0
            });
          } catch (e) {}
        }
        Player.startProgressTimer();
      }
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', () => document.body.classList.add('app-suspended'));
  window.addEventListener('pageshow', () => document.body.classList.remove('app-suspended'));

  console.log('[BluxWave] Ready.');
});

