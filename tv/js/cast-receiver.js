/**
 * cast-receiver.js - Google Cast / Cast Connect Receiver for BLUXWAVE ANDROID TV
 * 
 * Implements the receiver end of the BluxWave Cast protocol on namespace:
 * urn:x-cast:com.bluxwave.player
 * 
 * The TV is the single source of truth for playback. It executes incoming commands
 * from mobile senders, synchronizes queue, and broadcasts STATE_UPDATE.
 */

import { Player } from './player.js';
import { Queue } from './queue.js';

export const CAST_NAMESPACE = 'urn:x-cast:com.bluxwave.player';

export class CastReceiverManager {
  static init() {
    this.senders = new Set();
    this.progressSyncInterval = null;
    this.castReceiverContext = null;

    // Local broadcast channel fallback for development and local device testing
    this.localChannel = typeof window.BroadcastChannel !== 'undefined'
      ? new window.BroadcastChannel('bluxwave_cast_channel')
      : null;

    if (this.localChannel) {
      this.localChannel.onmessage = (event) => {
        if (event.data) {
          this.handleIncomingMessage(event.data, 'local_sender');
        }
      };
    }

    // Initialize Google Cast CAF Receiver if available
    this.initCafReceiver();

    // Subscribe to Player & Queue events to broadcast immediate state updates
    this.subscribeToPlayerEvents();

    console.log('[CastReceiver] Initialized on namespace:', CAST_NAMESPACE);
  }

  static initCafReceiver() {
    if (window.cast && window.cast.framework && window.cast.framework.CastReceiverContext) {
      try {
        const context = window.cast.framework.CastReceiverContext.getInstance();
        this.castReceiverContext = context;

        // Custom namespace configuration
        const options = new window.cast.framework.CastReceiverOptions();
        options.customNamespaces = {
          [CAST_NAMESPACE]: window.cast.framework.system.MessageType.JSON
        };

        // Add custom message listener
        context.addCustomMessageListener(CAST_NAMESPACE, (event) => {
          this.senders.add(event.senderId);
          this.handleIncomingMessage(event.data, event.senderId);
        });

        // Track connected senders
        context.addEventListener(window.cast.framework.system.EventType.SENDER_CONNECTED, (event) => {
          console.log('[CastReceiver] Sender connected:', event.senderId);
          this.senders.add(event.senderId);
          // Immediately send current state to newly connected sender
          this.broadcastState(event.senderId);
        });

        context.addEventListener(window.cast.framework.system.EventType.SENDER_DISCONNECTED, (event) => {
          console.log('[CastReceiver] Sender disconnected:', event.senderId);
          this.senders.delete(event.senderId);
        });

        context.start(options);
        console.log('[CastReceiver] Google Cast CAF Receiver Context started');
      } catch (err) {
        console.warn('[CastReceiver] Google Cast Receiver init error:', err);
      }
    }
  }

  static subscribeToPlayerEvents() {
    Player.on('stateChange', ({ isPlaying }) => {
      this.broadcastState();
      if (isPlaying) {
        this.startProgressSync();
      } else {
        this.stopProgressSync();
      }
    });

    Player.on('trackChange', () => {
      this.broadcastState();
    });

    Player.on('unplayable', () => {
      this.broadcastState();
    });

    // Listen to queue notifications
    Queue.subscribe(() => {
      this.broadcastState();
    });
  }

  static startProgressSync() {
    this.stopProgressSync();
    // Broadcast progress every 1000ms while playing
    this.progressSyncInterval = setInterval(() => {
      if (Player.isPlaying) {
        this.broadcastState();
      }
    }, 1000);
  }

  static stopProgressSync() {
    if (this.progressSyncInterval) {
      clearInterval(this.progressSyncInterval);
      this.progressSyncInterval = null;
    }
  }

  /**
   * Validate and process all incoming commands from mobile sender
   */
  static handleIncomingMessage(message, senderId) {
    if (!message || typeof message !== 'object') {
      try {
        message = JSON.parse(message);
      } catch (e) {
        console.warn('[CastReceiver] Malformed message received:', message);
        return;
      }
    }

    const { type } = message;
    if (!type) return;

    console.log('[CastReceiver] Processing command:', type, message);

    switch (type) {
      case 'PLAY':
        if (message.track) {
          const trackList = Array.isArray(message.contextQueue) ? message.contextQueue : null;
          Queue.playTrack(message.track, trackList);
        } else if (!Player.isPlaying) {
          Player.play();
        }
        break;

      case 'PAUSE':
        Player.pause();
        break;

      case 'RESUME':
        Player.play();
        break;

      case 'NEXT':
        Queue.next();
        break;

      case 'PREVIOUS':
        Queue.prev();
        break;

      case 'SEEK':
        if (typeof message.position === 'number' && !isNaN(message.position)) {
          Player.seekTo(message.position);
        }
        break;

      case 'SET_VOLUME':
        if (typeof message.volume === 'number' && !isNaN(message.volume)) {
          Player.setVolume(message.volume);
        }
        break;

      case 'ADD_TO_QUEUE':
        if (message.track) {
          if (message.playNext) {
            Queue.addNext(message.track);
          } else {
            Queue.add(message.track);
          }
        }
        break;

      case 'REMOVE_FROM_QUEUE':
        if (typeof message.index === 'number') {
          Queue.remove(message.index);
        }
        break;

      case 'MOVE_QUEUE_ITEM':
        this.handleMoveQueueItem(message.fromIndex, message.toIndex);
        break;

      case 'CLEAR_QUEUE':
        Queue.clear();
        break;

      case 'PLAY_QUEUE_ITEM':
        if (typeof message.index === 'number') {
          Queue.playIndex(message.index);
        }
        break;

      case 'GET_STATE':
      case 'SYNC_STATE':
        this.broadcastState(senderId);
        break;

      default:
        console.warn('[CastReceiver] Unknown command type:', type);
        break;
    }
  }

  static handleMoveQueueItem(fromIndex, toIndex) {
    if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') return;
    const uQueue = Queue.userQueue;
    if (fromIndex >= 0 && fromIndex < uQueue.length && toIndex >= 0 && toIndex < uQueue.length) {
      const [item] = uQueue.splice(fromIndex, 1);
      uQueue.splice(toIndex, 0, item);
      Queue.save();
      Queue.notify();
    }
  }

  /**
   * Generates comprehensive state snapshot where TV is source of truth
   */
  static getPlaybackState() {
    const queueData = Queue.getQueue ? Queue.getQueue() : {};
    return {
      type: 'STATE_UPDATE',
      currentTrack: Player.currentTrack || null,
      position: Player.currentTime || 0,
      duration: Player.duration || 0,
      playing: Player.isPlaying || false,
      volume: Player.volume || 80,
      queue: queueData.upcomingContext || queueData.contextQueue || Queue.tracks || [],
      userQueue: Queue.userQueue || [],
      currentIndex: Queue.currentIndex ?? -1,
      isShuffle: Queue.isShuffle || false,
      timestamp: Date.now()
    };
  }

  /**
   * Broadcast state to CAF senders and local channel
   */
  static broadcastState(targetSenderId = null) {
    const state = this.getPlaybackState();

    // 1. Google Cast CAF Receiver
    if (this.castReceiverContext) {
      try {
        if (targetSenderId && targetSenderId !== 'local_sender') {
          this.castReceiverContext.sendCustomMessage(CAST_NAMESPACE, targetSenderId, state);
        } else {
          // Broadcast to all senders
          this.senders.forEach((senderId) => {
            this.castReceiverContext.sendCustomMessage(CAST_NAMESPACE, senderId, state);
          });
        }
      } catch (e) {
        console.warn('[CastReceiver] Failed to send CAF message:', e);
      }
    }

    // 2. Local broadcast channel fallback
    if (this.localChannel) {
      try {
        this.localChannel.postMessage(state);
      } catch (e) {}
    }
  }
}
