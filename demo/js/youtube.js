/**
 * youtube.js - Curated Argentine Rock Library & Discovery Engine (Demo Portfolio Edition)
 * Zero API Keys required - Uses embedded player & static curated tracks
 */

import { Storage } from './storage.js';

// Curated Argentine Rock library for instant listening and portfolio demo
export const CURATED_TRACKS = [
  {
    id: 'T_FkEw27XJ0',
    title: 'De Música Ligera',
    artist: 'Soda Stereo',
    album: 'Canción Animal',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/T_FkEw27XJ0/hqdefault.jpg',
    duration: '03:32',
    durationSec: 212
  },
  {
    id: 'Z7AERldCALc',
    title: 'Hablando a Tu Corazón',
    artist: 'Charly García & Pedro Aznar',
    album: 'Tango',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/Z7AERldCALc/hqdefault.jpg',
    duration: '04:14',
    durationSec: 254
  },
  {
    id: 'UCF9oHXhDMU',
    title: 'Flaca',
    artist: 'Andrés Calamaro',
    album: 'Alta Suciedad',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/UCF9oHXhDMU/hqdefault.jpg',
    duration: '04:47',
    durationSec: 287
  },
  {
    id: 'uLIs0j2WnlM',
    title: 'Crimen',
    artist: 'Gustavo Cerati',
    album: 'Ahí Vamos',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/uLIs0j2WnlM/hqdefault.jpg',
    duration: '03:48',
    durationSec: 228
  },
  {
    id: 'DeMCz0O7-FM',
    title: 'Demoliendo Hoteles',
    artist: 'Charly García',
    album: 'Piano Bar',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/DeMCz0O7-FM/hqdefault.jpg',
    duration: '02:18',
    durationSec: 138
  },
  {
    id: 'Y20CWBUsGnk',
    title: 'Seminare',
    artist: 'Serú Girán',
    album: 'Serú Girán',
    genre: 'Rock Clásico',
    thumbnail: 'https://i.ytimg.com/vi/Y20CWBUsGnk/hqdefault.jpg',
    duration: '03:27',
    durationSec: 207
  },
  {
    id: 'VSWSnIcnoH4',
    title: 'Seguir Viviendo Sin Tu Amor',
    artist: 'Luis Alberto Spinetta',
    album: 'Pelusón of Milk',
    genre: 'Rock & Poesía',
    thumbnail: 'https://i.ytimg.com/vi/VSWSnIcnoH4/hqdefault.jpg',
    duration: '03:14',
    durationSec: 194
  },
  {
    id: 'F3aRzP3G-iY',
    title: 'Bajan',
    artist: 'Pescado Rabioso',
    album: 'Artaud',
    genre: 'Rock Progresivo',
    thumbnail: 'https://i.ytimg.com/vi/F3aRzP3G-iY/hqdefault.jpg',
    duration: '03:26',
    durationSec: 206
  },
  {
    id: 'kY31Wn6Q3wM',
    title: 'Jijiji',
    artist: 'Patricio Rey y sus Redonditos de Ricota',
    album: 'Oktubre',
    genre: 'Rock Ricotero',
    thumbnail: 'https://i.ytimg.com/vi/kY31Wn6Q3wM/hqdefault.jpg',
    duration: '05:34',
    durationSec: 334
  },
  {
    id: 'Fj7n01Z_H1g',
    title: 'Mariposa Tecknicolor',
    artist: 'Fito Páez',
    album: 'Circo Beat',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/Fj7n01Z_H1g/hqdefault.jpg',
    duration: '03:43',
    durationSec: 223
  },
  {
    id: '1To_Wz5RWi0',
    title: 'Mil Horas',
    artist: 'Los Abuelos de la Nada',
    album: 'Vasos y Besos',
    genre: 'Pop Rock 80s',
    thumbnail: 'https://i.ytimg.com/vi/1To_Wz5RWi0/hqdefault.jpg',
    duration: '02:50',
    durationSec: 170
  },
  {
    id: 'rVpP4P5-q4o',
    title: 'Persiana Americana',
    artist: 'Soda Stereo',
    album: 'Signos',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/rVpP4P5-q4o/hqdefault.jpg',
    duration: '04:52',
    durationSec: 292
  },
  {
    id: 'wXoG2W2Pq4A',
    title: 'Matador',
    artist: 'Los Fabulosos Cadillacs',
    album: 'Vasos Vacíos',
    genre: 'Ska / Rock',
    thumbnail: 'https://i.ytimg.com/vi/wXoG2W2Pq4A/hqdefault.jpg',
    duration: '04:34',
    durationSec: 274
  },
  {
    id: 'PAq7xAqXTxk',
    title: 'La Bestia Pop',
    artist: 'Patricio Rey y sus Redonditos de Ricota',
    album: 'Gulp!',
    genre: 'Rock Ricotero',
    thumbnail: 'https://i.ytimg.com/vi/PAq7xAqXTxk/hqdefault.jpg',
    duration: '02:44',
    durationSec: 164
  },
  {
    id: 'NuC3QMZ0HOU',
    title: 'A Rodar Mi Vida',
    artist: 'Fito Páez',
    album: 'El Amor Después del Amor',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/NuC3QMZ0HOU/hqdefault.jpg',
    duration: '04:44',
    durationSec: 284
  },
  {
    id: 'S016Y1P4nrs',
    title: 'Trátame Suavemente',
    artist: 'Soda Stereo',
    album: 'Soda Stereo',
    genre: 'Rock Nacional',
    thumbnail: 'https://i.ytimg.com/vi/S016Y1P4nrs/hqdefault.jpg',
    duration: '03:22',
    durationSec: 202
  }
];

// Curated Argentine Rock artists
export const CURATED_ARTISTS = [
  {
    id: 'artist-soda',
    name: 'Soda Stereo',
    avatar: 'https://i.ytimg.com/vi/T_FkEw27XJ0/hqdefault.jpg',
    subscribers: '3.8M seguidores',
    genre: 'Rock Nacional / New Wave'
  },
  {
    id: 'artist-charly',
    name: 'Charly García',
    avatar: 'https://i.ytimg.com/vi/DeMCz0O7-FM/hqdefault.jpg',
    subscribers: '1.9M seguidores',
    genre: 'Rock Nacional / Clásico'
  },
  {
    id: 'artist-spinetta',
    name: 'Luis Alberto Spinetta',
    avatar: 'https://i.ytimg.com/vi/VSWSnIcnoH4/hqdefault.jpg',
    subscribers: '1.2M seguidores',
    genre: 'Rock / Fusión Poética'
  },
  {
    id: 'artist-redondos',
    name: 'Patricio Rey y sus Redonditos de Ricota',
    avatar: 'https://i.ytimg.com/vi/kY31Wn6Q3wM/hqdefault.jpg',
    subscribers: '2.5M seguidores',
    genre: 'Rock Ricotero'
  },
  {
    id: 'artist-fito',
    name: 'Fito Páez',
    avatar: 'https://i.ytimg.com/vi/Fj7n01Z_H1g/hqdefault.jpg',
    subscribers: '2.1M seguidores',
    genre: 'Rock & Pop Argentino'
  },
  {
    id: 'artist-calamaro',
    name: 'Andrés Calamaro',
    avatar: 'https://i.ytimg.com/vi/UCF9oHXhDMU/hqdefault.jpg',
    subscribers: '2.3M seguidores',
    genre: 'Rock / Cantautor'
  },
  {
    id: 'artist-seru',
    name: 'Serú Girán',
    avatar: 'https://i.ytimg.com/vi/Y20CWBUsGnk/hqdefault.jpg',
    subscribers: '950K seguidores',
    genre: 'Rock Clásico & Progresivo'
  },
  {
    id: 'artist-cadillacs',
    name: 'Los Fabulosos Cadillacs',
    avatar: 'https://i.ytimg.com/vi/wXoG2W2Pq4A/hqdefault.jpg',
    subscribers: '2.9M seguidores',
    genre: 'Ska / Rock Latino'
  }
];

export const YouTubeAPI = {
  parseDuration(isoDuration) {
    if (!isoDuration) return { formatted: '--:--', seconds: 0 };
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = isoDuration.match(regex);
    if (!matches) return { formatted: '--:--', seconds: 0 };

    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    let formatted = '';
    if (hours > 0) {
      formatted += `${hours}:${minutes.toString().padStart(2, '0')}:`;
    } else {
      formatted += `${minutes}:`;
    }
    formatted += seconds.toString().padStart(2, '0');
    return { formatted, seconds: totalSeconds };
  },

  cleanArtistName(name) {
    if (!name) return 'Artista';
    return String(name)
      .replace(/\s*-\s*(Topic|Tema|Canal Oficial|Official Channel)$/i, '')
      .trim() || name;
  },

  isRestricted(videoId) {
    if (!videoId) return false;
    const list = Storage.get('restricted_tracks') || [];
    return list.includes(videoId);
  },

  markRestricted(videoId) {
    if (!videoId) return;
    const list = Storage.get('restricted_tracks') || [];
    if (!list.includes(videoId)) {
      list.push(videoId);
      Storage.set('restricted_tracks', list);
    }
  },

  /**
   * Search demo: filter locally through Argentine rock tracks
   */
  async search(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      return {
        artists: CURATED_ARTISTS.slice(0, 4),
        tracks: CURATED_TRACKS,
        results: CURATED_TRACKS,
        isFallback: true
      };
    }

    const filteredTracks = CURATED_TRACKS.filter(t => 
      !this.isRestricted(t.id) &&
      (t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    );
    const filteredArtists = CURATED_ARTISTS.filter(a =>
      a.name.toLowerCase().includes(q) || a.genre.toLowerCase().includes(q)
    );

    return {
      artists: filteredArtists.length > 0 ? filteredArtists : CURATED_ARTISTS.slice(0, 3),
      tracks: filteredTracks.length > 0 ? filteredTracks : CURATED_TRACKS,
      results: filteredTracks.length > 0 ? filteredTracks : CURATED_TRACKS,
      isFallback: true,
      message: 'Modo Demostración: Catálogo de Rock Nacional Argentino precargado.'
    };
  },

  async getArtistProfile(artistName, channelId = null) {
    const cleanName = this.cleanArtistName(artistName || 'Artista');
    const matchedArtist = CURATED_ARTISTS.find(a => this.cleanArtistName(a.name).toLowerCase() === cleanName.toLowerCase());
    const artistTracks = CURATED_TRACKS.filter(t => this.cleanArtistName(t.artist).toLowerCase().includes(cleanName.toLowerCase()));

    return {
      artist: {
        id: channelId || 'demo_artist',
        name: cleanName,
        avatar: matchedArtist?.avatar || 'https://i.ytimg.com/vi/T_FkEw27XJ0/hqdefault.jpg',
        subscribers: matchedArtist?.subscribers || 'Artista Clásico del Rock Nacional',
        description: matchedArtist?.genre || 'Rock Nacional Argentino'
      },
      tracks: artistTracks.length > 0 ? artistTracks : CURATED_TRACKS.slice(0, 6)
    };
  },

  async fetchDiscoveryContent(query) {
    return CURATED_TRACKS;
  }
};
