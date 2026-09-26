/**
 * history.js - Recently played track history
 */

import { Storage } from './storage.js';
import { Player } from './player.js';

class HistoryManager {
  constructor() {
    this.history = Storage.get('history') || [];
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

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.history);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.history));
  }
}

export const History = new HistoryManager();
