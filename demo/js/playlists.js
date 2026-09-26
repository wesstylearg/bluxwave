/**
 * playlists.js - Local playlists management (Demo Portfolio Edition)
 * Preloaded with Argentine Rock collections
 */

import { Storage } from './storage.js';
import { Queue } from './queue.js';
import { CURATED_TRACKS } from './youtube.js';

const DEFAULT_PLAYLISTS = [
  {
    id: 'pl-himnos',
    name: 'Himnos del Rock Nacional',
    createdAt: new Date().toISOString(),
    songs: [
      CURATED_TRACKS[0],  // De Música Ligera
      CURATED_TRACKS[1],  // Hablando a Tu Corazón
      CURATED_TRACKS[2],  // Flaca
      CURATED_TRACKS[3],  // Crimen
      CURATED_TRACKS[4],  // Demoliendo Hoteles
      CURATED_TRACKS[5],  // Seminare
      CURATED_TRACKS[6],  // Seguir Viviendo Sin Tu Amor
      CURATED_TRACKS[7],  // Bajan
      CURATED_TRACKS[8],  // Jijiji
      CURATED_TRACKS[9],  // Mariposa Tecknicolor
      CURATED_TRACKS[10], // Mil Horas
      CURATED_TRACKS[12]  // Matador
    ]
  },
  {
    id: 'pl-soda-cerati',
    name: 'Soda Stereo & Cerati Eternos',
    createdAt: new Date().toISOString(),
    songs: [
      CURATED_TRACKS[0],  // De Música Ligera
      CURATED_TRACKS[3],  // Crimen
      CURATED_TRACKS[11], // Persiana Americana
      CURATED_TRACKS[15]  // Trátame Suavemente
    ]
  },
  {
    id: 'pl-charly-seru',
    name: 'Charly García & Serú Girán',
    createdAt: new Date().toISOString(),
    songs: [
      CURATED_TRACKS[1], // Hablando a Tu Corazón
      CURATED_TRACKS[4], // Demoliendo Hoteles
      CURATED_TRACKS[5]  // Seminare
    ]
  }
];

class PlaylistManager {
  constructor() {
    const saved = Storage.get('playlists');
    if (!saved || saved.length === 0 || saved[0].name === 'Chill & Ambient') {
      this.playlists = DEFAULT_PLAYLISTS;
      this.save();
    } else {
      this.playlists = saved;
    }
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
    if (!pl) return false;

    const initialLen = pl.songs.length;
    pl.songs = pl.songs.filter(s => s.id !== songId);
    if (pl.songs.length !== initialLen) {
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  playAll(id, startIndex = 0) {
    const pl = this.getById(id);
    if (!pl || !pl.songs || pl.songs.length === 0) return;

    Queue.setQueue(pl.songs, startIndex);
  }

  save() {
    Storage.set('playlists', this.playlists);
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.playlists));
  }
}

export const Playlists = new PlaylistManager();
