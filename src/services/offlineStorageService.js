import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const STORAGE_KEYS = {
  ORDERS: 'cached_orders',
  PRODUCTS: 'cached_products',
  DELIVERIES: 'cached_deliveries',
  PROFILES: 'cached_profiles',
  CART: 'cart_items',
  SYNC_QUEUE: 'sync_queue',
  DEAD_LETTER_QUEUE: 'dead_letter_queue',
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
        timestamp: Date.now(),
        retryCount: operation.retryCount ?? 0,
        lastAttemptTimestamp: operation.lastAttemptTimestamp ?? null,
        maxRetries: operation.maxRetries ?? 5
      });
      await AsyncStorage.setItem(
        STORAGE_KEYS.SYNC_QUEUE,
        JSON.stringify(queue)
      );
      return { success: true, queueId };
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
   * Inspect sync queue health to detect stuck operations.
   */
  async getSyncQueueHealth(stuckThresholdMinutes = 60) {
    try {
      const queue = await this.getSyncQueue();
      if (!queue.length) {
        return {
          success: true,
          pendingCount: 0,
          oldestAgeMs: 0,
          isStuck: false,
        };
      }

      const now = Date.now();
      const oldestTimestamp = queue.reduce((min, op) => {
        const value = typeof op.timestamp === 'number' ? op.timestamp : now;
        return value < min ? value : min;
      }, now);

      const oldestAgeMs = now - oldestTimestamp;
      const stuckThresholdMs = stuckThresholdMinutes * 60 * 1000;

      return {
        success: true,
        pendingCount: queue.length,
        oldestAgeMs,
        isStuck: oldestAgeMs > stuckThresholdMs,
      };
    } catch (error) {
      console.error('Error checking sync queue health:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get dead-letter operations that exceeded max retries
   */
  async getDeadLetterQueue() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.DEAD_LETTER_QUEUE);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error getting dead letter queue:', error);
      return [];
    }
  },

  /**
   * Clear dead letter queue
   */
  async clearDeadLetterQueue() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.DEAD_LETTER_QUEUE);
      return { success: true };
    } catch (error) {
      console.error('Error clearing dead letter queue:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Process queued operations when back online with exponential backoff & dead-letter isolation
   */
  async processSyncQueue() {
    try {
      const queue = await this.getSyncQueue();
      const results = [];
      const updatedQueue = [];
      const newDeadLetters = [];
      const now = Date.now();

      for (const operation of queue) {
        const queueId = operation.queueId ?? operation.id;
        const recordId = operation.recordId ?? operation.targetId ?? operation.data?.id ?? operation.id;
        const retryCount = typeof operation.retryCount === 'number' ? operation.retryCount : 0;
        const maxRetries = typeof operation.maxRetries === 'number' ? operation.maxRetries : 5;
        const lastAttempt = operation.lastAttemptTimestamp ? Number(operation.lastAttemptTimestamp) : null;
        
        // Calculate exponential backoff delay: 1s, 2s, 4s, 8s, 16s... up to 30s
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 30000);

        // If still in backoff cool-down period, keep in queue and skip execution for this run
        if (lastAttempt && (now - lastAttempt) < backoffMs) {
          updatedQueue.push(operation);
          continue;
        }

        let opSuccess = false;
        let opError = null;

        try {
          let result = null;

          switch (operation.type) {
            case 'create_order':
              result = await supabase
                .from(operation.table)
                .insert([operation.data]);
              if (result.error) throw result.error;
              opSuccess = true;
              break;

            case 'create_order_bundle': {
              const orderPayload = operation?.data?.order;
              const itemsPayload = operation?.data?.items;

              if (!orderPayload || !Array.isArray(itemsPayload)) {
                throw new Error('Invalid order bundle payload');
              }

              let orderData = null;

              // Check if order was already created with this idempotency key
              if (orderPayload.idempotency_key) {
                const { data: existingOrder } = await supabase
                  .from('orders')
                  .select('id, order_number')
                  .eq('idempotency_key', orderPayload.idempotency_key)
                  .maybeSingle();

                if (existingOrder) {
                  orderData = existingOrder;
                }
              }

              if (!orderData) {
                const { data: insertedOrder, error: orderError } = await supabase
                  .from('orders')
                  .insert([orderPayload])
                  .select('id')
                  .single();

                if (orderError) {
                  // Handle unique key constraint if created concurrently
                  if (orderPayload.idempotency_key && (orderError.code === '23505' || orderError.message?.includes('duplicate key') || orderError.message?.includes('idempotency'))) {
                    const { data: recoveredOrder } = await supabase
                      .from('orders')
                      .select('id, order_number')
                      .eq('idempotency_key', orderPayload.idempotency_key)
                      .maybeSingle();
                    if (recoveredOrder) {
                      orderData = recoveredOrder;
                    }
                  }

                  if (!orderData) throw orderError;
                } else {
                  orderData = insertedOrder;
                }
              }

              if (orderPayload.idempotency_key) {
                const { data: existingItems } = await supabase
                  .from('order_items')
                  .select('id')
                  .eq('order_id', orderData.id);

                if (!existingItems || existingItems.length === 0) {
                  const orderItems = itemsPayload.map((item) => ({
                    ...item,
                    order_id: orderData.id,
                  }));

                  const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems);

                  if (itemsError) throw itemsError;
                }
              } else {
                const orderItems = itemsPayload.map((item) => ({
                  ...item,
                  order_id: orderData.id,
                }));

                const { error: itemsError } = await supabase
                  .from('order_items')
                  .insert(orderItems);

                if (itemsError) throw itemsError;
              }

              opSuccess = true;
              break;
            }

            case 'update':
              if (!recordId) {
                throw new Error('Missing recordId for update operation');
              }
              {
                const match = operation.match || { id: recordId };
                let query = supabase
                  .from(operation.table)
                  .update(operation.data);

                Object.entries(match).forEach(([key, value]) => {
                  query = query.eq(key, value);
                });

                result = await query;
                if (result.error) throw result.error;
                opSuccess = true;
              }
              break;

            case 'delete':
              if (!recordId) {
                throw new Error('Missing recordId for delete operation');
              }
              {
                const match = operation.match || { id: recordId };
                let query = supabase
                  .from(operation.table)
                  .delete();

                Object.entries(match).forEach(([key, value]) => {
                  query = query.eq(key, value);
                });

                result = await query;
                if (result.error) throw result.error;
                opSuccess = true;
              }
              break;

            default:
              console.warn('Unknown operation type:', operation.type);
              throw new Error(`Unknown operation type: ${operation.type}`);
          }
        } catch (err) {
          opError = err?.message || 'Unknown sync error';
          console.error(`Failed to sync operation ${queueId}:`, opError);
        }

        if (opSuccess) {
          results.push({ queueId, success: true });
        } else {
          const nextRetry = retryCount + 1;
          if (nextRetry >= maxRetries) {
            console.warn(`Sync operation ${queueId} exceeded max retries (${maxRetries}), moving to dead-letter queue.`);
            newDeadLetters.push({
              ...operation,
              failedAt: Date.now(),
              error: opError
            });
          } else {
            updatedQueue.push({
              ...operation,
              retryCount: nextRetry,
              lastAttemptTimestamp: Date.now(),
              lastError: opError
            });
          }
        }
      }

      // Persist dead letters if any failed permanently
      if (newDeadLetters.length > 0) {
        const existingDead = await this.getDeadLetterQueue();
        await AsyncStorage.setItem(
          STORAGE_KEYS.DEAD_LETTER_QUEUE,
          JSON.stringify([...existingDead, ...newDeadLetters])
        );
      }

      // Update sync queue with remaining unprocessed items
      if (updatedQueue.length === 0) {
        await AsyncStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
      } else {
        await AsyncStorage.setItem(
          STORAGE_KEYS.SYNC_QUEUE,
          JSON.stringify(updatedQueue)
        );
      }

      return {
        success: true,
        processed: results.length,
        pending: updatedQueue.length
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
