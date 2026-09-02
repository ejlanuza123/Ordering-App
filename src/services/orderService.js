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
};
