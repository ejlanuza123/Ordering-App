// src/services/riderPresenceService.js
//
// Keeps the rider's `is_online` and `last_seen` columns fresh in the
// `public.profiles` table.
//
// Three signals are combined to keep presence accurate even when the OS
// silently force-closes the app:
//   1. AppState changes (active / background / inactive)
//   2. NetInfo network state changes
//   3. A 30-second heartbeat that pings `last_seen`
//
// Even if all of the above fail, the server-side cron job
// `mark-stale-riders-offline` (added in migration
// 022_add_rider_offline_detection.sql) flips `is_online` to false after
// the rider's `last_seen` is more than 1 minute old.

import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';

const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

let heartbeatInterval = null;
let appStateSubscription = null;
let netInfoSubscription = null;
let currentRiderId = null;
let wasOnlineBeforeBackground = false;

export const riderPresenceService = {
  /**
   * Initialize presence tracking.
   * Call this when a rider logs in / app starts.
   */
  async initialize(riderId) {
    if (!riderId) {
      console.warn('[Presence] No riderId provided, skipping initialization');
      return;
    }

    currentRiderId = riderId;

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
   * Cleanup presence tracking.
   * Call this when a rider logs out.
   */
  async cleanup(riderId) {
    const targetRiderId = riderId || currentRiderId;

    this.stopHeartbeat();
    this.unsubscribeFromAppState();
    this.unsubscribeFromNetworkState();

    if (targetRiderId) {
      await this.setOnlineStatus(targetRiderId, false);
    }

    currentRiderId = null;
  },

  /**
   * Set rider online status in database.
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
    } catch (error) {
      console.error('[Presence] Failed to update online status:', error);
    }
  },

  /**
   * Update last_seen timestamp only (without changing is_online).
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
   * Start heartbeat to periodically update last_seen.
   */
  startHeartbeat(riderId) {
    this.stopHeartbeat(); // Clear any existing

    heartbeatInterval = setInterval(async () => {
      try {
        // Check if still connected
        const netState = await NetInfo.fetch();
        if (netState.isConnected) {
          await this.updateLastSeen(riderId);
        }
      } catch (error) {
        console.error('[Presence] Heartbeat error:', error);
      }
    }, HEARTBEAT_INTERVAL_MS);
  },

  /**
   * Stop heartbeat.
   */
  stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  },

  /**
   * Subscribe to AppState changes (foreground/background).
   */
  subscribeToAppState(riderId) {
    this.unsubscribeFromAppState(); // Clear any existing

    appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      try {
        if (nextAppState === 'active') {
          // App came to foreground
          const netState = await NetInfo.fetch();
          if (netState.isConnected && wasOnlineBeforeBackground) {
            await this.setOnlineStatus(riderId, true);
          }
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          // App went to background - mark as offline
          wasOnlineBeforeBackground = await this.checkIfOnline(riderId);
          await this.setOnlineStatus(riderId, false);
        }
      } catch (error) {
        console.error('[Presence] AppState handler error:', error);
      }
    });
  },

  /**
   * Unsubscribe from AppState.
   */
  unsubscribeFromAppState() {
    if (appStateSubscription) {
      appStateSubscription.remove();
      appStateSubscription = null;
    }
  },

  /**
   * Subscribe to network state changes using NetInfo.
   */
  subscribeToNetworkState(riderId) {
    this.unsubscribeFromNetworkState(); // Clear any existing

    netInfoSubscription = NetInfo.addEventListener(async (state) => {
      try {
        if (!state.isConnected) {
          // Network lost - mark offline
          await this.setOnlineStatus(riderId, false);
        } else {
          // Network restored - mark online
          await this.setOnlineStatus(riderId, true);
        }
      } catch (error) {
        console.error('[Presence] Network handler error:', error);
      }
    });
  },

  /**
   * Unsubscribe from network state.
   */
  unsubscribeFromNetworkState() {
    if (netInfoSubscription) {
      netInfoSubscription();
      netInfoSubscription = null;
    }
  },

  /**
   * Check if rider is currently online in database.
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
