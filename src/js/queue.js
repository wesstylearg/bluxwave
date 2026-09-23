/**
 * queue.js - Playback queue manager for BluxWave
 * Implements a Spotify-style two-tier queue:
 * 1. userQueue: Tracks manually added by the user (highest priority).
 * 2. contextQueue: The album/playlist/results being played in sequence or shuffle.
 */

import { Storage } from './storage.js';
import { Player } from './player.js';

class QueueManager {
  constructor() {
    this.userQueue = Storage.get('queue_user') || [];
    this.contextQueue = Storage.get('queue_context') || [];
    this.contextIndex = Storage.get('queue_context_index') ?? -1;
    this.currentTrack = Storage.get('queue_current') || null;
    this.history = [];
    this.isShuffle = Storage.get('queue_shuffle') || false;
    this.listeners = [];

    // Automatically transition to next track when one finishes
    Player.on('trackEnd', () => {
      this.next();
    });

    // Also update currentTrack when Player track changes
    Player.on('trackChange', (track) => {
      if (track) {
        this.currentTrack = track;
        this.save();
      }
    });

    // Automatically skip if YouTube cannot embed or play this track
    Player.on('unplayable', ({ track, code }) => {
      console.warn(`[Queue] Track ${track?.title || track?.id} cannot be played (code ${code}), skipping to next...`);
      setTimeout(() => {
        this.next();
      }, 300);
    });
  }

  // Compatibility getter
  get tracks() {
    return this.contextQueue;
  }

  get currentIndex() {
    return this.contextIndex;
  }

  getQueue() {
    return {
      currentTrack: this.currentTrack || (this.contextIndex >= 0 ? this.contextQueue[this.contextIndex] : null),
      userQueue: this.userQueue,
      contextQueue: this.contextQueue,
      contextIndex: this.contextIndex,
      upcomingContext: this.contextIndex >= 0 ? this.contextQueue.slice(this.contextIndex + 1) : this.contextQueue,
      isShuffle: this.isShuffle
    };
  }

  getCurrentTrack() {
    return this.currentTrack || (this.contextIndex >= 0 && this.contextIndex < this.contextQueue.length ? this.contextQueue[this.contextIndex] : null);
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    Storage.set('queue_shuffle', this.isShuffle);
    this.notify();
    return this.isShuffle;
  }

  /**
   * Play a track immediately.
   * If contextList is provided, initialize contextQueue with the list at the track's position.
   * Otherwise, play this track as standalone current track.
   */
  playTrack(track, contextList = null) {
    if (!track) return;
    if (contextList && Array.isArray(contextList) && contextList.length > 0) {
      const idx = contextList.findIndex(t => t.id === track.id);
      this.setQueue(contextList, idx >= 0 ? idx : 0);
      return;
    }
    this.currentTrack = track;
    this.contextQueue = [track];
    this.contextIndex = 0;
    this.save();
    Player.loadTrack(track, true);
    this.notify();
  }

  /**
   * Set context queue (e.g. playing an entire playlist or album)
   */
  setQueue(tracks, startIndex = 0) {
    this.contextQueue = [...tracks];
    this.contextIndex = startIndex;
    this.currentTrack = this.contextQueue[startIndex] || null;
    this.save();
    if (this.currentTrack) {
      Player.loadTrack(this.currentTrack, true);
    }
    this.notify();
  }

  /**
   * Add track to the manual user queue (plays before automatic queue)
   */
  add(track) {
    if (!this.currentTrack) {
      this.currentTrack = track;
      this.contextQueue = [track];
      this.contextIndex = 0;
      Player.loadTrack(track, true);
    } else {
      this.userQueue.push(track);
    }
    this.save();
    this.notify();
  }

  /**
   * Add track to play immediately next (top of userQueue)
   */
  addNext(track) {
    if (!this.currentTrack) {
      this.add(track);
    } else {
      this.userQueue.unshift(track);
      this.save();
      this.notify();
    }
  }

  /**
   * Remove an item from the manual user queue
   */
  removeUserQueue(index) {
    if (index >= 0 && index < this.userQueue.length) {
      this.userQueue.splice(index, 1);
      this.save();
      this.notify();
    }
  }

  /**
   * Remove track by general index (for backward compatibility)
   */
  remove(index) {
    if (index < this.userQueue.length) {
      this.removeUserQueue(index);
    } else {
      const ctxOffset = index - this.userQueue.length;
      if (ctxOffset >= 0 && ctxOffset < this.contextQueue.length) {
        this.contextQueue.splice(ctxOffset, 1);
        if (this.contextIndex >= ctxOffset) {
          this.contextIndex = Math.max(0, this.contextIndex - 1);
        }
        this.save();
        this.notify();
      }
    }
  }

  clearUserQueue() {
    this.userQueue = [];
    this.save();
    this.notify();
  }

  clear() {
    this.userQueue = [];
    this.contextQueue = [];
    this.contextIndex = -1;
    this.currentTrack = null;
    this.save();
    this.notify();
  }

  playIndex(index) {
    if (index >= 0 && index < this.contextQueue.length) {
      this.contextIndex = index;
      this.currentTrack = this.contextQueue[index];
      this.save();
      if (this.currentTrack) {
        Player.loadTrack(this.currentTrack, true);
      }
      this.notify();
    }
  }

  playUserQueueIndex(index) {
    if (index >= 0 && index < this.userQueue.length) {
      const track = this.userQueue.splice(index, 1)[0];
      if (this.currentTrack) {
        this.history.push(this.currentTrack);
      }
      this.currentTrack = track;
      this.save();
      Player.loadTrack(track, true);
      this.notify();
    }
  }

  next() {
    if (this.currentTrack) {
      this.history.push(this.currentTrack);
    }

    // 1. Manual userQueue has highest priority
    if (this.userQueue.length > 0) {
      this.currentTrack = this.userQueue.shift();
      this.save();
      Player.loadTrack(this.currentTrack, true);
      this.notify();
      return;
    }

    // 2. Fall back to contextQueue
    if (this.contextQueue.length === 0) {
      console.log('[Queue] Queue is completely empty');
      return;
    }

    if (this.isShuffle) {
      if (this.contextQueue.length === 1) {
        this.contextIndex = 0;
      } else {
        // Pick random index different from current
        let nextIdx;
        let attempts = 0;
        do {
          nextIdx = Math.floor(Math.random() * this.contextQueue.length);
          attempts++;
        } while (nextIdx === this.contextIndex && attempts < 10);
        this.contextIndex = nextIdx;
      }
      this.currentTrack = this.contextQueue[this.contextIndex];
      this.save();
      Player.loadTrack(this.currentTrack, true);
      this.notify();
    } else {
      if (this.contextIndex + 1 < this.contextQueue.length) {
        this.contextIndex++;
        this.currentTrack = this.contextQueue[this.contextIndex];
        this.save();
        Player.loadTrack(this.currentTrack, true);
        this.notify();
      } else {
        console.log('[Queue] Reached end of context queue');
      }
    }
  }

  prev() {
    if (Player.currentTime > 3) {
      Player.seekTo(0);
      return;
    }

    if (this.history.length > 0) {
      const prevTrack = this.history.pop();
      this.currentTrack = prevTrack;
      this.save();
      Player.loadTrack(prevTrack, true);
      this.notify();
      return;
    }

    if (this.contextIndex > 0) {
      this.contextIndex--;
      this.currentTrack = this.contextQueue[this.contextIndex];
      this.save();
      Player.loadTrack(this.currentTrack, true);
      this.notify();
    } else {
      Player.seekTo(0);
    }
  }

  save() {
    Storage.set('queue_user', this.userQueue);
    Storage.set('queue_context', this.contextQueue);
    Storage.set('queue_context_index', this.contextIndex);
    Storage.set('queue_current', this.currentTrack);
    Storage.set('queue_shuffle', this.isShuffle);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getQueue());
  }

  notify() {
    const q = this.getQueue();
    this.listeners.forEach(cb => cb(q));
  }
}

export const Queue = new QueueManager();

