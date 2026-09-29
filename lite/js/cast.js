/**
 * cast.js - Google Cast / Cast Connect Sender Controller for BLUXWAVE LITE
 * 
 * Manages Google Cast session, custom messaging protocol, and state synchronization.
 * The mobile phone acts purely as a CONTROLLER / SENDER, while the TV plays audio.
 */

export const CAST_NAMESPACE = 'urn:x-cast:com.bluxwave.player';

export const CastStatus = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  RECONNECTING: 'RECONNECTING'
};

class CastManagerController {
  constructor() {
    this.status = CastStatus.DISCONNECTED;
    this.connectedDevice = null;
    this.discoveredDevices = [];
    this.tvState = null;
    this.listeners = {
      statusChange: [],
      stateUpdate: [],
      devicesChange: []
    };

    this.castSession = null;
    this.isSdkAvailable = false;

    // Local broadcast channel fallback for instant testing / local pairing
    this.localChannel = typeof window.BroadcastChannel !== 'undefined'
      ? new window.BroadcastChannel('bluxwave_cast_channel')
      : null;

    if (this.localChannel) {
      this.localChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'STATE_UPDATE') {
          this.handleStateUpdate(event.data);
        }
      };
    }

    this.init();
  }

  init() {
    // 1. Google Cast SDK initialization hook
    window['__onGCastApiAvailable'] = (isAvailable) => {
      if (isAvailable) {
        this.isSdkAvailable = true;
        this.initCastContext();
      }
    };

    // If script is already cached/loaded
    if (window.cast && window.cast.framework) {
      this.isSdkAvailable = true;
      this.initCastContext();
    }

    // Native Android Cast handoff listener
    window.addEventListener('blux:nativeCastChange', (e) => {
      const data = e.detail;
      if (data && data.connected) {
        this.connectedDevice = {
          id: 'native_cast_device',
          name: data.deviceName || 'BLUXWAVE TV',
          type: 'Google Cast'
        };
        this.setStatus(CastStatus.CONNECTED);
      } else {
        this.connectedDevice = null;
        this.setStatus(CastStatus.DISCONNECTED);
      }
    });
  }

  initCastContext() {
    try {
      const context = window.cast.framework.CastContext.getInstance();
      context.setOptions({
        receiverApplicationId: 'CC1AD845', // Default Media Receiver / Cast Connect compatible
        autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
      });

      context.addEventListener(
        window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (event) => this.handleSessionStateChange(event)
      );

      context.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (event) => this.handleCastStateChange(event)
      );

      console.log('[CastManager] Google Cast Context initialized');
    } catch (err) {
      console.warn('[CastManager] Error initializing CastContext:', err);
    }
  }

  handleCastStateChange(event) {
    // Update discovered devices state
    const castState = event.castState;
    console.log('[CastManager] Cast State:', castState);
    this.updateDiscoveredDevices();
  }

  handleSessionStateChange(event) {
    const sessionState = event.sessionState;
    console.log('[CastManager] Session State:', sessionState);

    switch (sessionState) {
      case window.cast.framework.SessionState.SESSION_STARTING:
        this.setStatus(CastStatus.CONNECTING);
        break;

      case window.cast.framework.SessionState.SESSION_STARTED:
      case window.cast.framework.SessionState.SESSION_RESUMED:
        this.castSession = window.cast.framework.CastContext.getInstance().getCurrentSession();
        if (this.castSession) {
          const deviceName = this.castSession.getCastDevice().friendlyName || 'BLUXWAVE TV';
          this.connectedDevice = {
            id: this.castSession.getSessionId(),
            name: deviceName,
            type: 'Google Cast'
          };
          this.setupSessionListeners();
          this.setStatus(CastStatus.CONNECTED);
          this.requestState();
        }
        break;

      case window.cast.framework.SessionState.SESSION_ENDED:
        this.castSession = null;
        this.connectedDevice = null;
        this.tvState = null;
        this.setStatus(CastStatus.DISCONNECTED);
        break;

      case window.cast.framework.SessionState.SESSION_START_FAILED:
        this.setStatus(CastStatus.CONNECTION_ERROR);
        setTimeout(() => this.setStatus(CastStatus.DISCONNECTED), 3000);
        break;
    }
  }

  setupSessionListeners() {
    if (!this.castSession) return;

    try {
      this.castSession.addMessageListener(CAST_NAMESPACE, (namespace, message) => {
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message;
          if (data && data.type === 'STATE_UPDATE') {
            this.handleStateUpdate(data);
          }
        } catch (e) {
          console.warn('[CastManager] Failed to parse incoming Cast message:', e);
        }
      });
    } catch (e) {
      console.warn('[CastManager] Could not add Cast message listener:', e);
    }
  }

  /**
   * Request session launch or manual device connection
   */
  async requestSession() {
    if (this.isSdkAvailable && window.cast && window.cast.framework) {
      try {
        this.setStatus(CastStatus.CONNECTING);
        await window.cast.framework.CastContext.getInstance().requestSession();
      } catch (err) {
        console.warn('[CastManager] Request session failed or was dismissed:', err);
        this.setStatus(CastStatus.DISCONNECTED);
      }
    } else {
      // Connect to local paired channel fallback (e.g. TV in same browser / network)
      this.connectedDevice = {
        id: 'local_tv',
        name: 'BLUXWAVE TV',
        type: 'Dispositivo compatible'
      };
      this.setStatus(CastStatus.CONNECTED);
      this.requestState();
    }
  }

  /**
   * Connect specifically to a discovered device
   */
  connectToDevice(device) {
    if (device.type === 'Google Cast' && this.isSdkAvailable) {
      this.requestSession();
    } else {
      this.connectedDevice = device;
      this.setStatus(CastStatus.CONNECTED);
      this.requestState();
    }
  }

  /**
   * Disconnect mobile controller without stopping TV playback
   */
  disconnect() {
    if (typeof window.AndroidBridge !== 'undefined' && typeof window.AndroidBridge.disconnectCast === 'function') {
      try {
        window.AndroidBridge.disconnectCast();
      } catch (e) {}
    }

    if (this.castSession) {
      try {
        // Disconnect session without stopping app on TV
        window.cast.framework.CastContext.getInstance().endCurrentSession(false);
      } catch (e) {}
    }
    this.castSession = null;
    this.connectedDevice = null;
    this.tvState = null;
    this.setStatus(CastStatus.DISCONNECTED);
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      console.log('[CastManager] Status changed to:', newStatus);
      this.emit('statusChange', { status: this.status, device: this.connectedDevice });
    }
  }

  handleStateUpdate(state) {
    this.tvState = state;
    this.emit('stateUpdate', state);
  }

  updateDiscoveredDevices() {
    const list = [];
    if (this.isSdkAvailable) {
      list.push({ id: 'cast_device_available', name: 'Dispositivo Cast', type: 'Google Cast' });
    }
    list.push({ id: 'local_tv', name: 'BLUXWAVE TV', type: 'Dispositivo compatible' });
    this.discoveredDevices = list;
    this.emit('devicesChange', this.discoveredDevices);
  }

  get isConnected() {
    return this.status === CastStatus.CONNECTED && this.connectedDevice !== null;
  }

  // =========================================================================
  // COMMAND SENDER PROTOCOL
  // =========================================================================

  sendCommand(type, payload = {}) {
    if (!this.isConnected && this.status !== CastStatus.CONNECTING) return;

    const message = {
      type,
      ...payload,
      timestamp: Date.now()
    };

    console.log('[CastManager] Sending command:', type, message);

    // 1. Send via Google Cast CAF Session
    if (this.castSession) {
      try {
        this.castSession.sendMessage(CAST_NAMESPACE, message).catch((err) => {
          console.warn('[CastManager] Send message error:', err);
        });
      } catch (e) {
        console.warn('[CastManager] Send exception:', e);
      }
    }

    // 2. Send via Local Channel Fallback
    if (this.localChannel) {
      try {
        this.localChannel.postMessage(message);
      } catch (e) {}
    }
  }

  playTrack(track, contextQueue = null) {
    this.sendCommand('PLAY', { track, contextQueue });
  }

  pause() {
    this.sendCommand('PAUSE');
  }

  resume() {
    this.sendCommand('RESUME');
  }

  togglePlay() {
    if (this.tvState && this.tvState.playing) {
      this.pause();
    } else {
      this.resume();
    }
  }

  next() {
    this.sendCommand('NEXT');
  }

  previous() {
    this.sendCommand('PREVIOUS');
  }

  seekTo(position) {
    this.sendCommand('SEEK', { position });
  }

  setVolume(volume) {
    this.sendCommand('SET_VOLUME', { volume });
  }

  addToQueue(track, playNext = false) {
    this.sendCommand('ADD_TO_QUEUE', { track, playNext });
  }

  removeFromQueue(index) {
    this.sendCommand('REMOVE_FROM_QUEUE', { index });
  }

  moveQueueItem(fromIndex, toIndex) {
    this.sendCommand('MOVE_QUEUE_ITEM', { fromIndex, toIndex });
  }

  clearQueue() {
    this.sendCommand('CLEAR_QUEUE');
  }

  playQueueItem(index) {
    this.sendCommand('PLAY_QUEUE_ITEM', { index });
  }

  requestState() {
    this.sendCommand('GET_STATE');
  }

  // =========================================================================
  // EVENT SUBSCRIPTION
  // =========================================================================

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error('[CastManager] Error in listener callback:', e);
        }
      });
    }
  }
}

export const CastManager = new CastManagerController();
