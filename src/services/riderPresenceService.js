import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const DISCONNECT_DEBOUNCE_MS = 6000; // ignore blips shorter than this
const BACKGROUND_DEBOUNCE_MS = 4000; // ignore brief 'inactive' flickers (dialogs, control center, etc.)

let heartbeatInterval = null;
let appStateSubscription = null;
let netInfoSubscription = null;
let currentRiderId = null;
let wasOnlineBeforeBackground = false;
let disconnectTimer = null;
let backgroundTimer = null;
// Tracks whether the rider *wants* to be online, independent of transient
// network/app-state blips. Only explicit init/cleanup/manual toggle changes this.
let intendedOnline = false;

export const riderPresenceService = {
  /**
   * Initialize presence tracking
   * Call this when the rider logs in / app starts
   */
  async initialize(riderId) {
    if (currentRiderId === riderId) {
      // Already tracking this rider - don't clobber their manual online/offline choice.
      return;
    }

    currentRiderId = riderId;
    intendedOnline = true;

    // Start heartbeat
    this.startHeartbeat(riderId);

    // Subscribe to app state changes
    this.subscribeToAppState(riderId);

    // Subscribe to network state changes
    this.subscribeToNetworkState(riderId);

    // Set initial online status
    await this.setOnlineStatus(riderId, true);
  },

  /**
   * Cleanup presence tracking
   * Call this when rider logs out
   */
  async cleanup(riderId) {
    const targetRiderId = riderId || currentRiderId;

    intendedOnline = false;
    this._clearDisconnectTimer();
    this._clearBackgroundTimer();
    this.stopHeartbeat();
    this.unsubscribeFromAppState();
    this.unsubscribeFromNetworkState();

    if (targetRiderId) {
      await this.setOnlineStatus(targetRiderId, false);
    }

    currentRiderId = null;
  },

  _clearDisconnectTimer() {
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
  },

  _clearBackgroundTimer() {
    if (backgroundTimer) {
      clearTimeout(backgroundTimer);
      backgroundTimer = null;
    }
  },

  /**
   * Set rider online status in database
   */
  async setOnlineStatus(riderId, isOnline) {
    if (!riderId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_online: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', riderId);

      if (error) throw error;
      console.log(`[Presence] Rider ${isOnline ? 'online' : 'offline'} status set`);
    } catch (error) {
      console.error('[Presence] Failed to update online status:', error);
    }
  },

  /**
   * Update last_seen timestamp only (without changing is_online)
   */
  async updateLastSeen(riderId) {
    if (!riderId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          last_seen: new Date().toISOString()
        })
        .eq('id', riderId);

      if (error) throw error;
    } catch (error) {
      console.error('[Presence] Failed to update last_seen:', error);
    }
  },

  /**
   * Start heartbeat to periodically update last_seen
   */
  startHeartbeat(riderId) {
    this.stopHeartbeat(); // Clear any existing

    heartbeatInterval = setInterval(async () => {
      // Check if still connected
      const netState = await NetInfo.fetch();
      if (netState.isConnected) {
        await this.updateLastSeen(riderId);
        console.log('[Presence] Heartbeat: last_seen updated');
      }
    }, HEARTBEAT_INTERVAL_MS);

    console.log('[Presence] Heartbeat started');
  },

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      console.log('[Presence] Heartbeat stopped');
    }
  },

  /**
   * Subscribe to AppState changes (foreground/background)
   */
  subscribeToAppState(riderId) {
    this.unsubscribeFromAppState(); // Clear any existing

    appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log(`[Presence] AppState changed to: ${nextAppState}`);

      if (nextAppState === 'active') {
        // App came back to the foreground - cancel any pending "mark offline" timer
        this._clearBackgroundTimer();

        const netState = await NetInfo.fetch();
        if (netState.isConnected && intendedOnline) {
          await this.setOnlineStatus(riderId, true);
        }
      } else if (nextAppState === 'background') {
        // Only 'background' means the app was actually backgrounded.
        // 'inactive' also fires for brief system UI (permission prompts,
        // control center, the app-switcher preview) and should NOT flip status.
        wasOnlineBeforeBackground = intendedOnline;

        this._clearBackgroundTimer();
        backgroundTimer = setTimeout(async () => {
          backgroundTimer = null;
          await this.setOnlineStatus(riderId, false);
        }, BACKGROUND_DEBOUNCE_MS);
      }
      // 'inactive' is intentionally ignored - see comment above.
    });

    console.log('[Presence] AppState subscription started');
  },

  /**
   * Unsubscribe from AppState
   */
  unsubscribeFromAppState() {
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  },

  /**
   * Subscribe to network state changes using NetInfo directly
   */
  subscribeToNetworkState(riderId) {
    this.unsubscribeFromNetworkState(); // Clear any existing

    netInfoSubscription = NetInfo.addEventListener(async (state) => {
      // isInternetReachable can be `null` while it's still being determined -
      // treat that as "unknown", not "disconnected".
      const reachable = state.isConnected && state.isInternetReachable !== false;
      console.log(`[Presence] Network state changed: isConnected=${state.isConnected}, isInternetReachable=${state.isInternetReachable}`);

      if (!reachable) {
        // Don't immediately mark offline - a heavy screen (e.g. the map's
        // WebView loading tiles/routes) can cause a momentary false reading.
        // Wait to see if it's still disconnected after the debounce window.
        if (!disconnectTimer) {
          disconnectTimer = setTimeout(async () => {
            disconnectTimer = null;
            const current = await NetInfo.fetch();
            const stillDown = !current.isConnected || current.isInternetReachable === false;
            if (stillDown && intendedOnline) {
              await this.setOnlineStatus(riderId, false);
            }
          }, DISCONNECT_DEBOUNCE_MS);
        }
      } else {
        // Network confirmed up - cancel any pending offline write and
        // restore online status if the rider intends to be online.
        this._clearDisconnectTimer();
        if (intendedOnline) {
          await this.setOnlineStatus(riderId, true);
        }
      }
    });

    console.log('[Presence] Network state subscription started');
  },

  /**
   * Unsubscribe from network state
   */
  unsubscribeFromNetworkState() {
    if (netInfoSubscription) {
      netInfoSubscription();
      netInfoSubscription = null;
    }
  },

  /**
   * Get whether the rider currently intends to be online (manual toggle state).
   */
  isIntendedOnline() {
    return intendedOnline;
  },

  /**
   * Explicitly set intended online state (call this from the manual toggle
   * in settings) so automatic blip-correction doesn't fight the user's choice.
   */
  setIntendedOnline(value) {
    intendedOnline = value;
  },

  /**
   * Check if rider is currently online in database
   */
  async checkIfOnline(riderId) {
    if (!riderId) return false;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_online')
        .eq('id', riderId)
        .single();

      if (error) throw error;
      return data?.is_online ?? false;
    } catch (error) {
      console.error('[Presence] Failed to check online status:', error);
      return false;
    }
  }
};