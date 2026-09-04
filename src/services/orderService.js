import { supabase } from '../lib/supabase';
import { offlineStorageService } from './offlineStorageService';
import { networkStateService } from './networkStateService';

async function getOnlineState() {
  try {
    const status = await networkStateService.getStatus();
    return status?.isOnline === true;
  } catch {
    return false;
  }
}

export const orderService = {
  async createOrderWithItems({
    userId,
    orderInsert,
    orderItems,
    idempotencyKey,
  }) {
    const finalIdempotencyKey = idempotencyKey || orderInsert?.idempotency_key || null;
    const finalOrderInsert = {
      ...orderInsert,
      ...(finalIdempotencyKey ? { idempotency_key: finalIdempotencyKey } : {}),
    };

    const isOnline = await getOnlineState();

    if (!isOnline) {
      const queueResult = await offlineStorageService.queueOperation({
        type: 'create_order_bundle',
        table: 'orders',
        data: {
          userId,
          order: finalOrderInsert,
          items: orderItems,
        },
      });

      if (!queueResult.success) {
        throw new Error(queueResult.error || 'Failed to queue order while offline.');
      }

      return {
        success: true,
        queued: true,
        queueId: queueResult.queueId || null,
        idempotencyKey: finalIdempotencyKey,
      };
    }

    // Check if an order with this idempotency key was already created (e.g. from network timeout retry)
    if (finalIdempotencyKey) {
      try {
        const { data: existingOrder } = await supabase
          .from('orders')
          .select()
          .eq('user_id', userId)
          .eq('idempotency_key', finalIdempotencyKey)
          .maybeSingle();

        if (existingOrder) {
          const { data: existingItems } = await supabase
            .from('order_items')
            .select('id')
            .eq('order_id', existingOrder.id);

          if (!existingItems || existingItems.length === 0) {
            const itemsWithOrderId = orderItems.map((item) => ({
              ...item,
              order_id: existingOrder.id,
            }));
            await supabase.from('order_items').insert(itemsWithOrderId);
          }

          return {
            success: true,
            queued: false,
            order: existingOrder,
            deduplicated: true,
          };
        }
      } catch (checkErr) {
        console.warn('Idempotency check warning:', checkErr?.message);
      }
    }

    let orderData = null;
    let orderError = null;

    const insertResult = await supabase
      .from('orders')
      .insert([finalOrderInsert])
      .select()
      .single();

    orderData = insertResult?.data;
    orderError = insertResult?.error;

    // Handle race condition where idempotency unique constraint was triggered
    if (orderError && finalIdempotencyKey && (orderError.code === '23505' || orderError.message?.includes('duplicate key') || orderError.message?.includes('idempotency'))) {
      const { data: recoveredOrder } = await supabase
        .from('orders')
        .select()
        .eq('user_id', userId)
        .eq('idempotency_key', finalIdempotencyKey)
        .maybeSingle();

      if (recoveredOrder) {
        orderData = recoveredOrder;
        orderError = null;
      }
    }

    if (orderError) throw orderError;

    const orderId = orderData.id;
    const itemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: orderId,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) throw itemsError;

    return {
      success: true,
      queued: false,
      order: orderData,
    };
  },

  async updateOrder({ orderId, userId, updates }) {
    const isOnline = await getOnlineState();

    if (!isOnline) {
      const queueResult = await offlineStorageService.queueOperation({
        type: 'update',
        table: 'orders',
        recordId: orderId,
        match: {
          id: orderId,
          user_id: userId,
        },
        data: updates,
      });

      if (!queueResult.success) {
        throw new Error(queueResult.error || 'Failed to queue order update while offline.');
      }

      return {
        success: true,
        queued: true,
      };
    }

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .eq('user_id', userId);

    if (error) throw error;

    return {
      success: true,
      queued: false,
    };
  },

  /**
   * Retrieves pending offline-queued orders for a user from the sync queue.
   * Formats each queued mutation into a full order structure for immediate UI rendering.
   *
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  async getQueuedOrders(userId) {
    if (!userId) return [];
    try {
      const queue = await offlineStorageService.getSyncQueue();
      if (!Array.isArray(queue) || queue.length === 0) return [];

      const queuedOrders = queue
        .filter((op) => {
          const isOrderOp = op.type === 'create_order_bundle' || op.type === 'create_order';
          const matchesUser = op.data?.userId === userId || op.data?.order?.user_id === userId;
          return isOrderOp && matchesUser;
        })
        .map((op) => {
          const orderData = op.data?.order || {};
          const itemsData = op.data?.items || [];
          const qId = op.queueId || op.id || 'offline';

          return {
            id: `offline-${qId}`,
            queueId: qId,
            order_number: 'PENDING-SYNC',
            status: 'pending_sync',
            isOfflineQueued: true,
            created_at: new Date(op.timestamp || Date.now()).toISOString(),
            total_amount: Number(orderData.total_amount) || 0,
            delivery_fee: Number(orderData.delivery_fee) || 0,
            delivery_address: orderData.delivery_address || 'Current Location',
            delivery_lat: orderData.delivery_lat || null,
            delivery_lng: orderData.delivery_lng || null,
            payment_method: orderData.payment_method || 'Cash on Delivery',
            archived: false,
            order_items: itemsData.map((item) => ({
              quantity: item.quantity || 1,
              price_at_order: item.price_at_order || item.price || 0,
              products: {
                id: item.product_id || item.id,
                name: item.name || 'Product',
                category: item.category || 'General',
                unit: item.unit || 'pc',
              },
            })),
            deliveries: [],
          };
        });

      return queuedOrders;
    } catch (err) {
      console.warn('Failed to retrieve queued offline orders:', err?.message || err);
      return [];
    }
  },
};

