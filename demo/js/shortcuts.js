/**
 * shortcuts.js - Global keyboard shortcut handler
 */

import { Player } from './player.js';
import { UI } from './ui.js';

export function setupShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Prevent shortcut interception if user is typing in any text input
    const target = e.target;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        Player.togglePlay();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        Player.seekBy(-5);
        break;

      case 'ArrowRight':
        e.preventDefault();
        Player.seekBy(5);
        break;

      case 'ArrowUp':
        e.preventDefault();
        Player.changeVolume(5);
        UI.updateVolumeSlider(Player.volume);
        break;

      case 'ArrowDown':
        e.preventDefault();
        Player.changeVolume(-5);
        UI.updateVolumeSlider(Player.volume);
        break;

      case 'Escape':
        e.preventDefault();
        UI.handleEscapeKey();
        break;

      default:
        break;
    }
  });
}
