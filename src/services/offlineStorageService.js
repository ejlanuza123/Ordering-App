import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEYS = {
  ORDERS: 'cached_orders',
  PRODUCTS: 'cached_products',
  DELIVERIES: 'cached_deliveries',
  PROFILES: 'cached_profiles',
  CART: 'cart_items',
  SYNC_QUEUE: 'sync_queue',
  LAST_SYNC: 'last_sync'
};

export const offlineStorageService = {
  /**
   * Save data to local storage
   */
  async saveData(key, data, expirationMinutes = 60) {
    try {
      const storedData = {
        data,
        timestamp: Date.now(),
        expiration: expirationMinutes * 60 * 1000
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS[key] || key,
        JSON.stringify(storedData)
      );
      return { success: true };
    } catch (error) {
      console.error('Error saving data:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get data from local storage
   */
  async getData(key) {
    try {
      const stored = await AsyncStorage.getItem(
        STORAGE_KEYS[key] || key
      );

      if (!stored) return { success: false, data: null };

      const parsed = JSON.parse(stored);
      const isExpired = Date.now() - parsed.timestamp > parsed.expiration;

      if (isExpired) {
        await AsyncStorage.removeItem(STORAGE_KEYS[key] || key);
        return { success: false, data: null };
      }

      return { success: true, data: parsed.data };
    } catch (error) {
      console.error('Error getting data:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Clear all cached data
   */
  async clearCache() {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
      return { success: true };
    } catch (error) {
      console.error('Error clearing cache:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Add operation to sync queue for later processing
   */
  async queueOperation(operation) {
    try {
      const queue = await this.getSyncQueue();
      const queueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const recordId = operation.recordId ?? operation.targetId ?? operation.data?.id ?? operation.id;

      queue.push({
        ...operation,
        queueId,
        recordId,
        timestamp: Date.now()
      });
      await AsyncStorage.setItem(
        STORAGE_KEYS.SYNC_QUEUE,
        JSON.stringify(queue)
      );
      return { success: true };
    } catch (error) {
      console.error('Error queueing operation:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get all queued operations
   */
  async getSyncQueue() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error getting sync queue:', error);
      return [];
    }
  },

  /**
   * Process queued operations when back online
   */
  async processSyncQueue() {
    try {
      const queue = await this.getSyncQueue();
      const results = [];

      for (const operation of queue) {
        try {
          let result;
          const queueId = operation.queueId ?? operation.id;
          const recordId = operation.recordId ?? operation.targetId ?? operation.data?.id ?? operation.id;

          switch (operation.type) {
            case 'create_order':
              result = await supabase
                .from(operation.table)
                .insert([operation.data]);
              break;

            case 'update':
              if (!recordId) {
                results.push({ queueId, success: false, error: 'Missing recordId for update operation' });
                continue;
              }
              result = await supabase
                .from(operation.table)
                .update(operation.data)
                .eq('id', recordId);
              break;

            case 'delete':
              if (!recordId) {
                results.push({ queueId, success: false, error: 'Missing recordId for delete operation' });
                continue;
              }
              result = await supabase
                .from(operation.table)
                .delete()
                .eq('id', recordId);
              break;

            default:
              continue;
          }

          if (result.error) {
            console.error(`Failed to sync operation ${queueId}:`, result.error);
          } else {
            results.push({ queueId, success: true });
          }
        } catch (error) {
          console.error(`Error processing operation ${operation.queueId ?? operation.id}:`, error);
        }
      }

      // Remove processed operations
      const unprocessed = queue.filter(
        op => !results.find(r => r.queueId === (op.queueId ?? op.id) && r.success)
      );

      if (unprocessed.length === 0) {
        await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
      } else {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SYNC_QUEUE,
          JSON.stringify(unprocessed)
        );
      }

      return {
        success: true,
        processed: results.length,
        pending: unprocessed.length
      };
    } catch (error) {
      console.error('Error processing sync queue:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Save last sync timestamp
   */
  async updateLastSync(key) {
    try {
      const { data } = await this.getData('LAST_SYNC');
      const synced = data || {};
      synced[key] = Date.now();
      await this.saveData('LAST_SYNC', synced, 10080); // 1 week
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Get last sync time
   */
  async getLastSync(key) {
    try {
      const { data } = await this.getData('LAST_SYNC');
      const synced = data || {};
      return synced[key] || null;
    } catch (error) {
      return null;
    }
  }
};
