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
  }) {
    const isOnline = await getOnlineState();

    if (!isOnline) {
      const queueResult = await offlineStorageService.queueOperation({
        type: 'create_order_bundle',
        table: 'orders',
        data: {
          userId,
          order: orderInsert,
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
      };
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([orderInsert])
      .select()
      .single();

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
};
