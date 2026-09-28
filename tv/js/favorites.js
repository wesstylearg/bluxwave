/**
 * favorites.js - Unified with CDCollection (Single Source of Truth)
 * Kept for full backwards-compatibility with existing modules.
 */

import { CDCollection } from './collection.js';

class FavoritesManager {
  getAll() {
    return CDCollection.getAll().map(cd => ({
      id: cd.id,
      title: cd.trackTitle || cd.title,
      artist: cd.artist,
      thumbnail: cd.thumbnail,
      duration: cd.duration,
      genre: cd.genre,
      source: cd.source,
      sourceLabel: cd.sourceLabel,
      similarity: cd.similarity,
      ...cd
    }));
  }

  isFavorite(trackId) {
    return CDCollection.hasCD(trackId);
  }

  getById(trackId) {
    return CDCollection.getById(trackId);
  }

  toggle(track) {
    return CDCollection.toggleCD(track, 'collection');
  }

  remove(trackId) {
    return CDCollection.removeCD(trackId);
  }

  subscribe(callback) {
    return CDCollection.subscribe(() => {
      callback(this.getAll());
    });
  }

  notify() {
    CDCollection.notify();
  }
}

export const Favorites = new FavoritesManager();
