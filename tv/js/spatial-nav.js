/**
 * spatial-nav.js - Android TV D-Pad Remote Navigation Engine
 * 
 * Replaces keyboard shortcuts with 100% remote-control optimized D-Pad navigation:
 * - Up/Down/Left/Right: Spatial D-Pad movement across cards, carousels, and controls
 * - OK / Enter: Select or play focused item
 * - Back / Esc: Modal dismiss, view back to home, ambient queue close, or ambient exit
 * - Dedicated TV media buttons: PlayPause, Next, Previous
 * - ZERO shortcut volume/seeking collisions
 */

import { Player } from './player.js';

export class SpatialNavigator {
  constructor(options = {}) {
    this.currentFocused = null;
    this.idleTimer = null;
    this.idleDelay = 12000; // 12 seconds
    this.onIdle = options.onIdle || null;
    this.onUserActivity = options.onUserActivity || null;
    this.isAmbientActive = false;
    this.isQueueDrawerOpen = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.resetIdleTimer = this.resetIdleTimer.bind(this);
  }

  init() {
    window.addEventListener('keydown', this.handleKeyDown);

    // Initial focus after DOM renders
    setTimeout(() => {
      this.focusFirstAvailable();
    }, 400);

    this.startIdleTimer();
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.clearIdleTimer();
  }

  startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (this.onIdle) {
        this.onIdle();
      }
    }, this.idleDelay);
  }

  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  resetIdleTimer() {
    if (this.onUserActivity) {
      this.onUserActivity();
    }
    this.startIdleTimer();
  }

  getFocusableElements(container = document) {
    // 1. If a modal is open, trap focus strictly inside the modal
    const modal = document.getElementById('modal-backdrop');
    if (modal && modal.classList.contains('open')) {
      container = modal;
    } else if (this.isAmbientActive) {
      // 2. In Ambient mode, only allow focus inside the queue drawer if open
      if (this.isQueueDrawerOpen) {
        const drawer = document.getElementById('tv-ambient-queue-drawer');
        if (drawer) container = drawer;
      } else {
        // Leanback ambient screen has no active focus ring
        return [];
      }
    }

    const elements = Array.from(
      container.querySelectorAll('.tv-focusable, [tabindex="0"], button:not([disabled]), input:not([disabled])')
    );

    return elements.filter(el => {
      if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  }

  focusElement(el) {
    if (!el) return;
    if (this.currentFocused && this.currentFocused !== el) {
      this.currentFocused.classList.remove('is-focused');
      this.currentFocused.blur();
    }

    this.currentFocused = el;
    el.classList.add('is-focused');
    el.focus({ preventScroll: true });

    // Smooth centering for TV screen
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }

  focusFirstAvailable(container = document) {
    const list = this.getFocusableElements(container);
    if (list.length > 0) {
      this.focusElement(list[0]);
    }
  }

  handleKeyDown(e) {
    this.resetIdleTimer();

    const key = e.key;
    const code = e.code;

    // 1. Android TV Remote Dedicated Media Keys (hardware buttons)
    if (key === 'MediaPlayPause' || code === 'MediaPlayPause') {
      e.preventDefault();
      Player.togglePlay();
      return;
    }
    if (key === 'MediaTrackNext' || code === 'MediaTrackNext') {
      e.preventDefault();
      Player.next();
      return;
    }
    if (key === 'MediaTrackPrevious' || code === 'MediaTrackPrevious') {
      e.preventDefault();
      Player.previous();
      return;
    }
    if (key === 'MediaStop' || code === 'MediaStop') {
      e.preventDefault();
      Player.pause();
      return;
    }

    // 2. Android TV Remote "Back" Button (Escape, Backspace, GoBack)
    if (['Escape', 'Backspace', 'GoBack', 'BrowserBack'].includes(key)) {
      if (this.isAmbientActive) {
        e.preventDefault();
        if (this.isQueueDrawerOpen) {
          window.dispatchEvent(new CustomEvent('tv-ambient-hide-queue'));
        } else {
          window.dispatchEvent(new CustomEvent('tv-exit-ambient'));
        }
        return;
      }

      const modal = document.getElementById('modal-backdrop');
      if (modal && modal.classList.contains('open')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('tv-close-modal'));
        return;
      }

      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        e.preventDefault();
        document.activeElement.blur();
        this.focusFirstAvailable();
        return;
      }

      // Return to Home view if in a sub-view
      if (window.bluxUI && window.bluxUI.currentView && window.bluxUI.currentView !== 'home') {
        e.preventDefault();
        window.bluxUI.showView('home');
        return;
      }
    }

    // 3. Spacebar (Playback Toggle if not in text input)
    if (key === ' ' || code === 'Space') {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        return; // Allow typing space in search
      }
      e.preventDefault();
      Player.togglePlay();
      return;
    }

    // 4. Directional D-Pad & Action Keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
      // In text input, allow down/up to leave input, but allow typing/submitting on Enter
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          document.activeElement.blur();
        } else if (key === 'Enter') {
          return; // Let Enter submit the input
        } else {
          return; // Left/Right moves text cursor
        }
      }

      this.processDirectionalKey(key, e);
    }
  }

  processDirectionalKey(key, e) {
    // A. Ambient TV Mode
    if (this.isAmbientActive) {
      if (this.isQueueDrawerOpen) {
        if (key === 'ArrowUp') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tv-ambient-hide-queue'));
          return;
        }
        if (key === 'ArrowDown') {
          e.preventDefault();
          return; // Stay in drawer
        }
        if (key === 'ArrowLeft' || key === 'ArrowRight') {
          e.preventDefault();
          this.navigateDirection(key);
          return;
        }
        if (key === 'Enter') {
          if (this.currentFocused) {
            e.preventDefault();
            this.currentFocused.click();
          }
          return;
        }
      } else {
        // Leanback ambient mode (drawer closed)
        if (key === 'ArrowDown') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tv-ambient-show-queue'));
          return;
        }
        if (key === 'Enter') {
          e.preventDefault();
          Player.togglePlay();
          return;
        }
        if (key === 'ArrowRight') {
          e.preventDefault();
          Player.next();
          return;
        }
        if (key === 'ArrowLeft') {
          e.preventDefault();
          Player.previous();
          return;
        }
        if (key === 'ArrowUp') {
          e.preventDefault();
          return;
        }
      }
    }

    // B. Normal TV Navigation Mode
    if (key === 'Enter') {
      if (this.currentFocused) {
        e.preventDefault();
        this.currentFocused.click();
      }
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      e.preventDefault();
      this.navigateDirection(key);
    }
  }

  navigateDirection(direction) {
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    if (!this.currentFocused || !document.contains(this.currentFocused)) {
      this.focusFirstAvailable();
      return;
    }

    // Check if moving within a horizontal carousel track or queue drawer track
    const currentTrack = this.currentFocused.closest('.tv-carousel-track, .tv-drawer-track');
    if (currentTrack) {
      const itemsInTrack = Array.from(currentTrack.querySelectorAll('.tv-focusable'));
      const currentIndex = itemsInTrack.indexOf(this.currentFocused);

      if (direction === 'ArrowRight' && currentIndex >= 0 && currentIndex < itemsInTrack.length - 1) {
        this.focusElement(itemsInTrack[currentIndex + 1]);
        return;
      }

      if (direction === 'ArrowLeft' && currentIndex > 0) {
        this.focusElement(itemsInTrack[currentIndex - 1]);
        return;
      }
    }

    // Geometry-based spatial navigation between sections & rows
    const currentRect = this.currentFocused.getBoundingClientRect();
    let bestCandidate = null;
    let minDistance = Infinity;

    for (const candidate of focusable) {
      if (candidate === this.currentFocused) continue;
      const rect = candidate.getBoundingClientRect();

      let isCandidateInDirection = false;
      let primaryDiff = 0;
      let secondaryDiff = 0;

      switch (direction) {
        case 'ArrowUp':
          isCandidateInDirection = rect.bottom <= currentRect.top + 12;
          primaryDiff = currentRect.top - rect.bottom;
          secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (rect.left + rect.width / 2));
          break;
        case 'ArrowDown':
          isCandidateInDirection = rect.top >= currentRect.bottom - 12;
          primaryDiff = rect.top - currentRect.bottom;
          secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (rect.left + rect.width / 2));
          break;
        case 'ArrowLeft':
          isCandidateInDirection = rect.right <= currentRect.left + 12;
          primaryDiff = currentRect.left - rect.right;
          secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (rect.top + rect.height / 2));
          break;
        case 'ArrowRight':
          isCandidateInDirection = rect.left >= currentRect.right - 12;
          primaryDiff = rect.left - currentRect.right;
          secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (rect.top + rect.height / 2));
          break;
      }

      if (isCandidateInDirection) {
        // Weighted distance prioritizing the primary directional axis
        const distance = primaryDiff * 1.0 + secondaryDiff * 2.2;
        if (distance < minDistance) {
          minDistance = distance;
          bestCandidate = candidate;
        }
      }
    }

    if (bestCandidate) {
      this.focusElement(bestCandidate);
    }
  }
}
