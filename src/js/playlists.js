/**
 * playlists.js - Local playlists management
 */

import { Storage } from './storage.js';
import { Queue } from './queue.js';

class PlaylistManager {
  constructor() {
    this.playlists = Storage.get('playlists') || [
      {
        id: 'pl-ambient',
        name: 'Chill & Ambient',
        createdAt: new Date().toISOString(),
        songs: [
          {
            id: 'jfKfPfyJRdk',
            title: 'lofi hip hop radio - beats to relax/study to',
            artist: 'Lofi Girl',
            thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg',
            duration: 'Live',
            durationSec: 0
          },
          {
            id: 'kgx4WGK0oNU',
            title: 'Clair de Lune - Claude Debussy',
            artist: 'Rousseau',
            thumbnail: 'https://i.ytimg.com/vi/kgx4WGK0oNU/hqdefault.jpg',
            duration: '05:04',
            durationSec: 304
          }
        ]
      }
    ];
    this.listeners = [];
  }

  getAll() {
    return this.playlists;
  }

  getById(id) {
    return this.playlists.find(p => p.id === id);
  }

  create(name, cover = null) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;

    const newPlaylist = {
      id: 'pl-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      name: trimmed,
      cover: cover || null,
      createdAt: new Date().toISOString(),
      songs: []
    };

    this.playlists.push(newPlaylist);
    this.save();
    this.notify();
    return newPlaylist;
  }

  update(id, { name, cover }) {
    const pl = this.getById(id);
    if (!pl) return false;

    if (name !== undefined && name.trim()) {
      pl.name = name.trim();
    }
    if (cover !== undefined) {
      pl.cover = cover ? cover.trim() : null;
    }

    this.save();
    this.notify();
    return true;
  }

  getCover(playlist) {
    if (!playlist) return null;
    if (playlist.cover) return playlist.cover;
    if (playlist.songs && playlist.songs.length > 0 && playlist.songs[0].thumbnail) {
      return playlist.songs[0].thumbnail;
    }
    return null;
  }

  delete(id) {
    this.playlists = this.playlists.filter(p => p.id !== id);
    this.save();
    this.notify();
  }

  addSong(playlistId, song) {
    const pl = this.getById(playlistId);
    if (!pl || !song || !song.id) return false;

    // Avoid duplicate within same playlist
    if (!pl.songs.some(s => s.id === song.id)) {
      pl.songs.push(song);
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  removeSong(playlistId, songId) {
    const pl = this.getById(playlistId);
    if (!pl) return;

    pl.songs = pl.songs.filter(s => s.id !== songId);
    this.save();
    this.notify();
  }

  play(playlistId, startIndex = 0) {
    const pl = this.getById(playlistId);
    if (!pl || pl.songs.length === 0) return;

    Queue.setQueue(pl.songs, startIndex);
  }

  save() {
    Storage.set('playlists', this.playlists);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.playlists);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.playlists));
  }
}

export const Playlists = new PlaylistManager();
