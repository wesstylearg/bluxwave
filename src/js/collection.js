/**
 * collection.js - Digital CD Collection Manager for BluxWave
 * Handles user's collected physical-style CDs gathered via Radar and Library.
 */

import { Storage } from './storage.js';

class CDCollectionManager {
  constructor() {
    const raw = Storage.get('cd_collection') || [];
    // Clean out any legacy mock starter items
    this.collection = raw.filter(cd => !String(cd.id).startsWith('cd-starter-'));

    // Auto-migrate any legacy favorites into the collection so no user music is lost
    const legacyFavs = Storage.get('favorites') || [];
    if (legacyFavs.length > 0) {
      let migrated = false;
      legacyFavs.forEach(fav => {
        if (fav && fav.id && !this.collection.some(cd => String(cd.id) === String(fav.id))) {
          this.collection.push({
            id: fav.id,
            title: fav.album || fav.title || 'Álbum',
            trackTitle: fav.title || 'Canción',
            artist: fav.artist || 'Artista',
            thumbnail: fav.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
            duration: fav.duration || '3:30',
            genre: fav.genre || 'Colección',
            addedAt: fav.addedAt || new Date().toISOString()
          });
          migrated = true;
        }
      });
      if (migrated || this.collection.length !== raw.length) {
        this.save();
      }
    } else if (this.collection.length !== raw.length) {
      this.save();
    }

    // Clean up any legacy sourceLabel or 'Colección Personal' strings from stored CDs
    let cleaned = false;
    this.collection.forEach(cd => {
      if (cd.sourceLabel || cd.similarity) {
        delete cd.sourceLabel;
        delete cd.similarity;
        delete cd.connectionReason;
        if (cd.source === 'radar') cd.source = 'collection';
        cleaned = true;
      }
    });
    if (cleaned) {
      this.save();
    }

    this.listeners = [];
  }

  getAll() {
    return this.collection;
  }

  getById(id) {
    return this.collection.find(cd => String(cd.id) === String(id));
  }

  hasCD(id) {
    return this.collection.some(cd => String(cd.id) === String(id));
  }

  toggleCD(track, metadata = {}) {
    if (!track || !track.id) return false;
    if (this.hasCD(track.id)) {
      this.removeCD(track.id);
      return false; // removed
    } else {
      this.addCD(track, metadata);
      return true; // added
    }
  }

  addCD(track, metadata = {}) {
    if (!track || !track.id) return null;

    // Check if already in collection
    const existingIndex = this.collection.findIndex(cd => String(cd.id) === String(track.id));
    if (existingIndex !== -1) {
      // Bring to top
      const existing = this.collection.splice(existingIndex, 1)[0];
      this.collection.unshift(existing);
      this.save();
      this.notify();
      return existing;
    }

    const newCD = {
      id: track.id,
      title: metadata.album || track.title || 'Álbum',
      trackTitle: track.title || 'Canción',
      artist: track.artist || 'Artista',
      thumbnail: track.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
      duration: track.duration || '3:30',
      genre: metadata.genre || 'Música',
      addedAt: new Date().toISOString()
    };

    this.collection.unshift(newCD);
    this.save();
    this.notify();
    return newCD;
  }

  removeCD(id) {
    const prevLength = this.collection.length;
    this.collection = this.collection.filter(cd => cd.id !== id);
    if (this.collection.length !== prevLength) {
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  save() {
    Storage.set('cd_collection', this.collection);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.collection);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.collection));
  }
}

export const CDCollection = new CDCollectionManager();
