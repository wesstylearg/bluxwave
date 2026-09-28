/**
 * spatial-nav.js - Android TV Spatial & D-Pad Remote Navigation Engine
 */

import { Player } from './player.js';

export class SpatialNavigator {
  constructor(options = {}) {
    this.currentFocused = null;
    this.idleTimer = null;
    this.idleDelay = 10000; // 10 seconds
    this.onIdle = options.onIdle || null;
    this.onUserActivity = options.onUserActivity || null;
    this.isAmbientActive = false;
    this.isQueueDrawerOpen = false;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.resetIdleTimer = this.resetIdleTimer.bind(this);
  }

  init() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('mousemove', this.resetIdleTimer);
    window.addEventListener('mousedown', this.resetIdleTimer);

    // Initial focus after DOM is ready
    setTimeout(() => {
      this.focusFirstAvailable();
    }, 500);

    this.startIdleTimer();
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('mousemove', this.resetIdleTimer);
    window.removeEventListener('mousedown', this.resetIdleTimer);
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
    // Only elements that are visible and have .tv-focusable or tabindex >= 0
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

    // Scroll into view nicely
    el.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
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

    // Media and navigation keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace'].includes(key)) {
      // If user is typing in an active text input, let left/right move cursor unless at boundary
      if (document.activeElement && document.activeElement.tagName === 'INPUT' && !['Escape', 'Enter'].includes(key)) {
        if (key === 'ArrowUp' || key === 'ArrowDown') {
          // Allow up/down to exit search input
        } else {
          return;
        }
      }

      this.processDirectionalKey(key, e);
    }
  }

  processDirectionalKey(key, e) {
    // If in Ambient Mode
    if (this.isAmbientActive) {
      if (this.isQueueDrawerOpen) {
        if (key === 'ArrowUp') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tv-ambient-hide-queue'));
          return;
        }
        if (key === 'ArrowDown') {
          // Stay inside queue drawer
          e.preventDefault();
          return;
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
        if (key === 'Escape' || key === 'Backspace') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tv-ambient-hide-queue'));
          return;
        }
      } else {
        // Ambient mode with drawer closed
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
        if (key === 'Escape' || key === 'Backspace') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('tv-exit-ambient'));
          return;
        }
      }
    }

    if (key === 'Escape' || key === 'Backspace') {
      // Handle back button on remote
      const modal = document.getElementById('modal-backdrop');
      if (modal && modal.classList.contains('open')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('tv-close-modal'));
        return;
      }
    }

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

    // Geometry-based spatial navigation for general layout
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
          isCandidateInDirection = rect.bottom <= currentRect.top + 8;
          primaryDiff = currentRect.top - rect.bottom;
          secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (rect.left + rect.width / 2));
          break;
        case 'ArrowDown':
          isCandidateInDirection = rect.top >= currentRect.bottom - 8;
          primaryDiff = rect.top - currentRect.bottom;
          secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (rect.left + rect.width / 2));
          break;
        case 'ArrowLeft':
          isCandidateInDirection = rect.right <= currentRect.left + 8;
          primaryDiff = currentRect.left - rect.right;
          secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (rect.top + rect.height / 2));
          break;
        case 'ArrowRight':
          isCandidateInDirection = rect.left >= currentRect.right - 8;
          primaryDiff = rect.left - currentRect.right;
          secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (rect.top + rect.height / 2));
          break;
      }

      if (isCandidateInDirection) {
        // Weighted Manhattan distance prioritizing the primary direction
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
