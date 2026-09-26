/**
 * history.js - Recently played track history (Demo Portfolio Edition)
 */

import { Storage } from './storage.js';
import { Player } from './player.js';
import { CURATED_TRACKS } from './youtube.js';

const DEFAULT_HISTORY = [
  { ...CURATED_TRACKS[0], playedAt: new Date(Date.now() - 3600000).toISOString() },
  { ...CURATED_TRACKS[1], playedAt: new Date(Date.now() - 7200000).toISOString() },
  { ...CURATED_TRACKS[2], playedAt: new Date(Date.now() - 14400000).toISOString() },
  { ...CURATED_TRACKS[3], playedAt: new Date(Date.now() - 28800000).toISOString() }
];

class HistoryManager {
  constructor() {
    const saved = Storage.get('history');
    if (!saved || saved.length === 0) {
      this.history = DEFAULT_HISTORY;
      this.save();
    } else {
      this.history = saved;
    }
    this.listeners = [];

    // Automatically record tracks when played
    Player.on('trackChange', (track) => {
      this.add(track);
    });
  }

  getAll() {
    return this.history;
  }

  add(track) {
    if (!track || !track.id) return;

    // Filter out if already in history so we push it to top
    this.history = this.history.filter(t => t.id !== track.id);
    this.history.unshift({
      ...track,
      playedAt: new Date().toISOString()
    });

    // Keep last 100 entries
    if (this.history.length > 100) {
      this.history.pop();
    }

    this.save();
    this.notify();
  }

  clear() {
    this.history = [];
    this.save();
    this.notify();
  }

  save() {
    Storage.set('history', this.history);
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.history));
  }
}

export const History = new HistoryManager();
