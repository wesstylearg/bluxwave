/**
 * app.js - Main Application Bootstrap for BluxWave
 */

import { UI } from './ui.js';
import { Player } from './player.js';
import { Queue } from './queue.js';
import { Auth } from './auth.js';
import { setupShortcuts } from './shortcuts.js';
import { CURATED_TRACKS } from './youtube.js';

window.addEventListener('DOMContentLoaded', () => {
  console.log('[BluxWave] Initializing minimal desktop player...');

  // Expose on window for handlers
  window.bluxUI = UI;
  window.bluxPlayer = Player;
  window.bluxQueue = Queue;
  window.bluxAuth = Auth;

  // Initialize Auth, UI & Shortcuts
  Auth.init();
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

  console.log('[BluxWave] Ready.');
});
