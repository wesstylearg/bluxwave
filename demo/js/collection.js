/**
 * collection.js - Digital CD Collection Manager for BluxWave (Demo Portfolio Edition)
 * Preloaded with physical-style CD cases of Argentine Rock
 */

import { Storage } from './storage.js';

const DEFAULT_CDS = [
  {
    id: 'T_FkEw27XJ0',
    title: 'Canción Animal',
    trackTitle: 'De Música Ligera',
    artist: 'Soda Stereo',
    thumbnail: 'https://i.ytimg.com/vi/T_FkEw27XJ0/hqdefault.jpg',
    duration: '03:32',
    genre: 'Rock Nacional',
    addedAt: new Date().toISOString()
  },
  {
    id: 'Z7AERldCALc',
    title: 'Tango',
    trackTitle: 'Hablando a Tu Corazón',
    artist: 'Charly García & Pedro Aznar',
    thumbnail: 'https://i.ytimg.com/vi/Z7AERldCALc/hqdefault.jpg',
    duration: '04:14',
    genre: 'Rock Nacional',
    addedAt: new Date().toISOString()
  },
  {
    id: 'uLIs0j2WnlM',
    title: 'Ahí Vamos',
    trackTitle: 'Crimen',
    artist: 'Gustavo Cerati',
    thumbnail: 'https://i.ytimg.com/vi/uLIs0j2WnlM/hqdefault.jpg',
    duration: '03:48',
    genre: 'Rock Nacional',
    addedAt: new Date().toISOString()
  },
  {
    id: 'Y20CWBUsGnk',
    title: 'Serú Girán',
    trackTitle: 'Seminare',
    artist: 'Serú Girán',
    thumbnail: 'https://i.ytimg.com/vi/Y20CWBUsGnk/hqdefault.jpg',
    duration: '03:27',
    genre: 'Rock Clásico',
    addedAt: new Date().toISOString()
  },
  {
    id: 'F3aRzP3G-iY',
    title: 'Artaud',
    trackTitle: 'Bajan',
    artist: 'Pescado Rabioso',
    thumbnail: 'https://i.ytimg.com/vi/F3aRzP3G-iY/hqdefault.jpg',
    duration: '03:26',
    genre: 'Rock Progresivo',
    addedAt: new Date().toISOString()
  },
  {
    id: 'kY31Wn6Q3wM',
    title: 'Oktubre',
    trackTitle: 'Jijiji',
    artist: 'Patricio Rey y sus Redonditos de Ricota',
    thumbnail: 'https://i.ytimg.com/vi/kY31Wn6Q3wM/hqdefault.jpg',
    duration: '05:34',
    genre: 'Rock Ricotero',
    addedAt: new Date().toISOString()
  },
  {
    id: 'UCF9oHXhDMU',
    title: 'Alta Suciedad',
    trackTitle: 'Flaca',
    artist: 'Andrés Calamaro',
    thumbnail: 'https://i.ytimg.com/vi/UCF9oHXhDMU/hqdefault.jpg',
    duration: '04:47',
    genre: 'Rock Nacional',
    addedAt: new Date().toISOString()
  },
  {
    id: 'Fj7n01Z_H1g',
    title: 'Circo Beat',
    trackTitle: 'Mariposa Tecknicolor',
    artist: 'Fito Páez',
    thumbnail: 'https://i.ytimg.com/vi/Fj7n01Z_H1g/hqdefault.jpg',
    duration: '03:43',
    genre: 'Rock Nacional',
    addedAt: new Date().toISOString()
  }
];

class CDCollectionManager {
  constructor() {
    const raw = Storage.get('cd_collection') || [];
    const valid = raw.filter(cd => cd && cd.id && !String(cd.id).startsWith('cd-starter-'));

    if (valid.length === 0) {
      this.collection = DEFAULT_CDS;
      this.save();
    } else {
      this.collection = valid;
    }

    this.listeners = [];
  }

  getAll() {
    return this.collection;
  }

  getById(id) {
    return this.collection.find(cd => cd.id === id);
  }

  hasCD(trackId) {
    return this.collection.some(cd => cd.id === trackId);
  }

  addCD(track, source = 'collection') {
    if (!track || !track.id) return false;
    if (this.hasCD(track.id)) return false;

    const newCD = {
      id: track.id,
      title: track.album || track.title || 'Álbum',
      trackTitle: track.title || 'Canción',
      artist: track.artist || 'Artista',
      thumbnail: track.thumbnail || 'https://i.ytimg.com/vi/T_FkEw27XJ0/hqdefault.jpg',
      duration: track.duration || '3:30',
      genre: track.genre || 'Rock Nacional',
      addedAt: new Date().toISOString()
    };

    this.collection.unshift(newCD);
    this.save();
    this.notify();
    return true;
  }

  removeCD(trackId) {
    const initialLen = this.collection.length;
    this.collection = this.collection.filter(cd => cd.id !== trackId);
    if (this.collection.length !== initialLen) {
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  toggleCD(track, source = 'collection') {
    if (!track || !track.id) return false;
    if (this.hasCD(track.id)) {
      this.removeCD(track.id);
      return false;
    } else {
      this.addCD(track, source);
      return true;
    }
  }

  save() {
    Storage.set('cd_collection', this.collection);
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(cb => cb(this.collection));
  }
}

export const CDCollection = new CDCollectionManager();
