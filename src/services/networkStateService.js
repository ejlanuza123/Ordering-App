import NetInfo from '@react-native-community/netinfo';
import { offlineStorageService } from './offlineStorageService';

/**
 * Network state monitor – detects online/offline transitions
 * and triggers sync queue processing when reconnecting.
 */

let unsubscribeNetInfo = null;
let isCurrentlyOnline = null;
let offlineStartedAt = null;
let syncInProgress = false;

export const networkStateService = {
  /**
   * Start monitoring network state
   * Automatically processes sync queue when transitioning from offline → online
   */
  async startMonitoring() {
    if (unsubscribeNetInfo) {
      console.warn('Network monitoring already started');
      return;
    }

    try {
      // Get initial state
      const initialState = await NetInfo.fetch();
      isCurrentlyOnline = initialState.isConnected;

      const queueHealth = await offlineStorageService.getSyncQueueHealth();
      if (queueHealth.success && queueHealth.isStuck) {
        console.warn('[NetworkState] Sync queue appears stuck:', queueHealth);
      }

      // Subscribe to state changes
      unsubscribeNetInfo = NetInfo.addEventListener(async (state) => {
        const wasOffline = !isCurrentlyOnline;
        const isNowOnline = state.isConnected;

        // Transition from offline → online: trigger sync
        if (wasOffline && isNowOnline) {
          const offlineDurationMs = offlineStartedAt ? Date.now() - offlineStartedAt : null;

          if (offlineDurationMs !== null) {
            console.log(`[NetworkState] Reconnected after ${offlineDurationMs}ms offline`);
          }

          console.log('[NetworkState] Reconnected – processing sync queue');
          await this.processSyncQueue();

          const postSyncHealth = await offlineStorageService.getSyncQueueHealth();
          if (postSyncHealth.success && postSyncHealth.isStuck) {
            console.warn('[NetworkState] Sync queue still stuck after reconnect:', postSyncHealth);
          }

          offlineStartedAt = null;
        }

        if (!isNowOnline && !wasOffline) {
          offlineStartedAt = Date.now();
        }

        isCurrentlyOnline = isNowOnline;
      });

      console.log('[NetworkState] Monitoring started');
    } catch (error) {
      console.error('[NetworkState] Failed to start monitoring:', error);
    }
  },

  /**
   * Stop monitoring network state
   */
  stopMonitoring() {
    if (unsubscribeNetInfo) {
      unsubscribeNetInfo();
      unsubscribeNetInfo = null;
      offlineStartedAt = null;
      console.log('[NetworkState] Monitoring stopped');
    }
  },

  /**
   * Process sync queue when online
   */
  async processSyncQueue() {
    if (syncInProgress) {
      return {
        success: true,
        skipped: true,
        reason: 'sync_already_in_progress'
      };
    }

    syncInProgress = true;
    try {
      const result = await offlineStorageService.processSyncQueue();
      console.log('[NetworkState] Sync queue processed:', {
        success: result.success,
        processed: result.processed,
        pending: result.pending
      });
      return result;
    } catch (error) {
      console.error('[NetworkState] Failed to process sync queue:', error);
      return { success: false, error: error.message };
    } finally {
      syncInProgress = false;
    }
  },

  /**
   * Get current online status
   */
  async getStatus() {
    try {
      const state = await NetInfo.fetch();
      return {
        isOnline: state.isConnected,
        type: state.type,
        strength: state.details?.strength || null
      };
    } catch (error) {
      console.error('[NetworkState] Failed to get status:', error);
      return { isOnline: null, error: error.message };
    }
  },

  /**
   * Check if currently online
   */
  get isOnline() {
    return isCurrentlyOnline;
  }
};
