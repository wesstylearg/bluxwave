/**
 * app.js - Main Application Bootstrap for BluxWave Lite
 */

import { UI } from './ui.js';
import { Player } from './player.js';
import { Queue } from './queue.js';
import { Auth } from './auth.js';
import { CloudSync } from './sync.js';
import { setupShortcuts } from './shortcuts.js';
import { CURATED_TRACKS } from './youtube.js';
import { CastManager } from './cast.js';
import { MediaSessionManager } from './media-session.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('[BluxWave] Initializing BluxWave Lite with Cast Connect...');

  // Expose on window for handlers
  window.bluxUI = UI;
  window.bluxPlayer = Player;
  window.bluxQueue = Queue;
  window.bluxAuth = Auth;
  window.bluxCloudSync = CloudSync;
  window.bluxCast = CastManager;

  // Initialize Auth, CloudSync, MediaSession, UI & Shortcuts
  Auth.init();
  CloudSync.init();
  MediaSessionManager.init();
  UI.init();
  setupShortcuts();

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
      // If connected to TV, request fresh state on resume
      if (CastManager.isConnected) {
        CastManager.requestState();
      } else if (Player.isPlaying) {
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
