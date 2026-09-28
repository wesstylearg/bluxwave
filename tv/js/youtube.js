/**
 * youtube.js - YouTube Data API v3 Client, Curated Library & Discovery Engine
 */

import { Config } from './config.js';
import { Storage } from './storage.js';

// Curated music library for instant listening and out-of-the-box experience
export const CURATED_TRACKS = [
  {
    id: 'kgx4WGK0oNU',
    title: 'Clair de Lune - Claude Debussy',
    artist: 'Rousseau',
    thumbnail: 'https://i.ytimg.com/vi/kgx4WGK0oNU/hqdefault.jpg',
    duration: '05:04',
    durationSec: 304
  },
  {
    id: '5qap5aO4i9A',
    title: 'Lofi Hip Hop Radio - Beats to Sleep/Chill to',
    artist: 'Lofi Girl',
    thumbnail: 'https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg',
    duration: 'Live',
    durationSec: 0
  },
  {
    id: '4xDzrJKXOOY',
    title: 'synthwave radio - chill synth / retro beats',
    artist: 'Lofi Girl - Synthwave',
    thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg',
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
  },
  {
    id: 'q76bMs-NwRk',
    title: 'Gymnopédie No. 1 - Erik Satie',
    artist: 'Rousseau',
    thumbnail: 'https://i.ytimg.com/vi/q76bMs-NwRk/hqdefault.jpg',
    duration: '03:12',
    durationSec: 192
  },
  {
    id: 'DWcJFNfaw9c',
    title: 'Peaceful Piano Radio - Relaxing Music',
    artist: 'Lofi Girl',
    thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg',
    duration: 'Live',
    durationSec: 0
  },
  {
    id: 'Dx5qFachd3A',
    title: 'Winter in Nagasaki - Lofi Hip Hop Beats',
    artist: 'Chillhop Music',
    thumbnail: 'https://i.ytimg.com/vi/Dx5qFachd3A/hqdefault.jpg',
    duration: '03:25',
    durationSec: 205
  },
  {
    id: 'turbOzq5514',
    title: 'Moonlight Sonata - Ludwig van Beethoven',
    artist: 'Rousseau',
    thumbnail: 'https://i.ytimg.com/vi/turbOzq5514/hqdefault.jpg',
    duration: '06:18',
    durationSec: 378
  }
];

// Curated artists for fallback & instant discovery
export const CURATED_ARTISTS = [
  {
    id: 'UCrwt3J3cvi_vL_bK781HhyA',
    name: 'Lofi Girl',
    avatar: 'https://yt3.googleusercontent.com/w9cO-f2bW9Ww1V2u3tCjR6sV7V9g6v5H8w=s176-c-k-c0x00ffffff-no-rj',
    subscribers: '14.2M suscriptores',
    genre: 'Lo-Fi / Chillhop'
  },
  {
    id: 'UC472b_o6P2dE0kP7-Hh4bLQ',
    name: 'Rousseau',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_k6gV7oV6vP1s9qZ0=s176-c-k-c0x00ffffff-no-rj',
    subscribers: '4.8M suscriptores',
    genre: 'Classical Piano'
  },
  {
    id: 'UC2XdaAVUannpujzv32jcouQ',
    name: 'Queen Official',
    avatar: 'https://yt3.googleusercontent.com/ytc/AIdro_n_Yw3sF6r=s176-c-k-c0x00ffffff-no-rj',
    subscribers: '17.8M suscriptores',
    genre: 'Rock Legend'
  },
  {
    id: 'UC0C-w0YjGpqDXGB8Tr0669Q',
    name: 'Ed Sheeran',
    avatar: 'https://yt3.googleusercontent.com/nJbWbK2FkY8v7=s176-c-k-c0x00ffffff-no-rj',
    subscribers: '54.5M suscriptores',
    genre: 'Pop / Acoustic'
  },
  {
    id: 'UCmSinb1B43_sZ_gJ3hV4Fvg',
    name: 'Men I Trust',
    avatar: 'https://i.ytimg.com/vi/DqgLgE15h3w/hqdefault.jpg',
    subscribers: '1.2M suscriptores',
    genre: 'Dream Pop / Indie'
  },
  {
    id: 'UC1G4VzFkE9FvV_Lq8_e2L2w',
    name: 'Khruangbin',
    avatar: 'https://i.ytimg.com/vi/q4xKvHANqjk/hqdefault.jpg',
    subscribers: '890K suscriptores',
    genre: 'Psychedelic Funk'
  }
];

export const YouTubeAPI = {
  /**
   * Parse ISO 8601 duration (e.g. PT3M45S, PT1H2M10S) to readable string and seconds
   */
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

  /**
   * Strip YouTube auto-generated channel suffix (' - Topic', ' - Tema', etc.)
   */
  cleanArtistName(name) {
    if (!name) return 'Artista';
    return String(name)
      .replace(/\s*-\s*(Topic|Tema|Canal Oficial|Official Channel)$/i, '')
      .trim() || name;
  },

  /**
   * Check if track has been flagged as copyright/embed restricted
   */
  isRestricted(videoId) {
    if (!videoId) return false;
    const list = Storage.get('restricted_tracks') || [];
    return list.includes(videoId);
  },

  /**
   * Flag track as restricted so it never appears again
   */
  markRestricted(videoId) {
    if (!videoId) return;
    const list = Storage.get('restricted_tracks') || [];
    if (!list.includes(videoId)) {
      list.push(videoId);
      Storage.set('restricted_tracks', list);
    }
  },

  /**
   * Search both songs and artists using YouTube Data API v3
   * Returns separated { artists: [...], tracks: [...] }
   */
  async search(query) {
    const apiKey = Config.getApiKey();

    if (!apiKey) {
      console.warn('[YouTubeAPI] No API key configured. Filtering curated catalog.');
      const q = query.toLowerCase().trim();
      const filteredTracks = CURATED_TRACKS.filter(t => 
        !this.isRestricted(t.id) &&
        (t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
      );
      const filteredArtists = CURATED_ARTISTS.filter(a =>
        a.name.toLowerCase().includes(q) || a.genre.toLowerCase().includes(q)
      );

      return {
        artists: filteredArtists.length > 0 ? filteredArtists : CURATED_ARTISTS.slice(0, 3),
        tracks: filteredTracks.length > 0 ? filteredTracks : CURATED_TRACKS.filter(t => !this.isRestricted(t.id)),
        results: filteredTracks.length > 0 ? filteredTracks : CURATED_TRACKS.filter(t => !this.isRestricted(t.id)),
        isFallback: true,
        message: 'Configura tu YouTube API Key en Ajustes para buscar en todo el catálogo de YouTube.'
      };
    }

    try {
      // Execute 2 queries in parallel with embeddability enforced: (1) Artists/channels and (2) Music videos
      const encodedQ = encodeURIComponent(query);
      const [channelsRes, searchRes] = await Promise.all([
        fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=4&q=${encodedQ}&key=${apiKey}`).catch(() => null),
        fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&videoEmbeddable=true&videoSyndicated=true&maxResults=25&q=${encodedQ}&key=${apiKey}`)
      ]);

      let rawArtists = [];
      if (channelsRes && channelsRes.ok) {
        const chanData = await channelsRes.json();
        rawArtists = (chanData.items || []).map(item => ({
          id: item.id.channelId,
          name: this.cleanArtistName(item.snippet.channelTitle || item.snippet.title),
          avatar: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
          description: item.snippet.description || 'Canal de artista'
        }));
      }

      // Deduplicate artists by normalized name and consolidate into the best profile (with avatar)
      const artistsMap = new Map();
      for (const a of rawArtists) {
        const norm = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!norm) continue;
        if (!artistsMap.has(norm)) {
          artistsMap.set(norm, a);
        } else {
          const existing = artistsMap.get(norm);
          const hasBetterAvatar = (!existing.avatar || existing.avatar.includes('default_avatar')) && (a.avatar && !a.avatar.includes('default_avatar'));
          if (hasBetterAvatar) {
            artistsMap.set(norm, a);
          }
        }
      }

      // Limit to 1 or 2 artists maximum
      const artists = Array.from(artistsMap.values()).slice(0, 2);

      if (!searchRes.ok) {
        const errorData = await searchRes.json().catch(() => ({}));
        const reason = errorData?.error?.errors?.[0]?.reason || searchRes.statusText;
        throw new Error(reason || `Error HTTP ${searchRes.status}`);
      }

      const searchData = await searchRes.json();
      const items = searchData.items || [];
      const videoIds = items.map(item => item.id.videoId).filter(Boolean).join(',');

      if (!videoIds) {
        return { artists, tracks: [], results: [], isFallback: false };
      }

      // Step 2: Fetch durations, status and embeddability check with videos endpoint
      const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet,status&id=${videoIds}&key=${apiKey}`;
      const detailsRes = await fetch(detailsUrl);
      const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };

      const detailsMap = new Map();
      (detailsData.items || []).forEach(v => detailsMap.set(v.id, v));

      const tracks = [];
      for (const item of items) {
        const id = item.id.videoId;
        if (!id || this.isRestricted(id)) continue;

        const detail = detailsMap.get(id);
        // Exclude if embedding is explicitly disabled by copyright owner
        if (detail?.status && detail.status.embeddable === false) {
          this.markRestricted(id);
          continue;
        }

        const isoDuration = detail?.contentDetails?.duration;
        const durationInfo = this.parseDuration(isoDuration);

        // Sanitize title (remove HTML entities)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = item.snippet.title;
        const cleanTitle = tempDiv.textContent || tempDiv.innerText || item.snippet.title;

        tracks.push({
          id,
          title: cleanTitle,
          artist: this.cleanArtistName(item.snippet.channelTitle || 'Artista'),
          channelId: item.snippet.channelId,
          thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          duration: durationInfo.formatted,
          durationSec: durationInfo.seconds
        });
      }

      return { artists, tracks, results: tracks, isFallback: false };
    } catch (err) {
      console.error('[YouTubeAPI] Search error:', err);
      return {
        artists: [],
        tracks: [],
        results: [],
        error: err.message || 'Error de conexión con YouTube'
      };
    }
  },

  /**
   * Get artist profile and their popular tracks
   */
  async getArtistProfile(artistName, channelId = null) {
    const apiKey = Config.getApiKey();

    if (!apiKey) {
      // Fallback artist profile
      const cleanName = this.cleanArtistName(artistName || 'Artista');
      const matchedArtist = CURATED_ARTISTS.find(a => this.cleanArtistName(a.name).toLowerCase() === cleanName.toLowerCase());
      const artistTracks = CURATED_TRACKS.filter(t => this.cleanArtistName(t.artist).toLowerCase().includes(cleanName.toLowerCase()));

      return {
        artist: {
          id: channelId || 'fallback_artist',
          name: cleanName,
          avatar: matchedArtist?.avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
          subscribers: matchedArtist?.subscribers || 'Artista verificado',
          description: matchedArtist?.genre || 'Música en BluxWave'
        },
        tracks: artistTracks.length > 0 ? artistTracks : CURATED_TRACKS.slice(0, 5)
      };
    }

    try {
      let avatar = '';
      let title = this.cleanArtistName(artistName);
      let subscribers = '';
      let description = '';

      // If channelId provided, fetch channel snippet & stats
      if (channelId) {
        try {
          const chanRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`);
          if (chanRes.ok) {
            const chanData = await chanRes.json();
            const ch = chanData.items?.[0];
            if (ch) {
              title = this.cleanArtistName(ch.snippet?.title || title);
              avatar = ch.snippet?.thumbnails?.high?.url || ch.snippet?.thumbnails?.medium?.url;
              const subs = parseInt(ch.statistics?.subscriberCount || '0', 10);
              subscribers = subs > 1000000 ? `${(subs / 1000000).toFixed(1)}M suscriptores` : subs > 1000 ? `${(subs / 1000).toFixed(0)}K suscriptores` : `${subs} suscriptores`;
              description = ch.snippet?.description || '';
            }
          }
        } catch (e) {
          console.warn('[YouTubeAPI] Error fetching channel info:', e);
        }
      }

      // Fetch top tracks for this artist
      const query = encodeURIComponent(`${title} official music`);
      const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=15&order=viewCount&q=${query}&key=${apiKey}`);
      
      let tracks = [];
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const items = searchData.items || [];
        const videoIds = items.map(item => item.id.videoId).filter(Boolean).join(',');

        if (videoIds) {
          const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${apiKey}`);
          const detailsData = detailsRes.ok ? await detailsRes.json() : { items: [] };
          const detailsMap = new Map();
          (detailsData.items || []).forEach(v => detailsMap.set(v.id, v));

          tracks = items.map(item => {
            const id = item.id.videoId;
            const detail = detailsMap.get(id);
            const isoDuration = detail?.contentDetails?.duration;
            const durationInfo = this.parseDuration(isoDuration);

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = item.snippet.title;
            const cleanTitle = tempDiv.textContent || tempDiv.innerText || item.snippet.title;

            if (!avatar && item.snippet.thumbnails?.high?.url) {
              avatar = item.snippet.thumbnails.high.url;
            }

            return {
              id,
              title: cleanTitle,
              artist: title,
              channelId: item.snippet.channelId,
              thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
              duration: durationInfo.formatted,
              durationSec: durationInfo.seconds
            };
          });
        }
      }

      return {
        artist: {
          id: channelId || 'artist_profile',
          name: title,
          avatar: avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
          subscribers: subscribers || 'Artista en YouTube',
          description: description || ''
        },
        tracks
      };
    } catch (err) {
      console.error('[YouTubeAPI] getArtistProfile error:', err);
      return {
        artist: {
          id: channelId || 'fallback_artist',
          name: this.cleanArtistName(artistName),
          avatar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
          subscribers: 'Artista',
          description: ''
        },
        tracks: []
      };
    }
  },

  /**
   * Fetch songs for music discovery tiers
   */
  async fetchDiscoveryContent(query) {
    const searchRes = await this.search(query);
    return searchRes.tracks || searchRes.results || [];
  }
};

