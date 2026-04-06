const mockGetStatus = jest.fn();
const mockQueueOperation = jest.fn();

const mockFrom = jest.fn();
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();

jest.mock('../../services/networkStateService', () => ({
  networkStateService: {
    getStatus: (...args) => mockGetStatus(...args),
  },
}));

jest.mock('../../services/offlineStorageService', () => ({
  offlineStorageService: {
    queueOperation: (...args) => mockQueueOperation(...args),
  },
}));

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

describe('orderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues createOrderWithItems when offline', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: false });
    mockQueueOperation.mockResolvedValue({ success: true, queueId: 'q-1' });

    const { orderService } = require('../../services/orderService');

    const result = await orderService.createOrderWithItems({
      userId: 'u-1',
      orderInsert: { user_id: 'u-1', total_amount: 100 },
      orderItems: [{ product_id: 'p-1', quantity: 1, price_at_order: 100 }],
    });

    expect(result).toEqual({ success: true, queued: true, queueId: 'q-1' });
    expect(mockQueueOperation).toHaveBeenCalledWith({
      type: 'create_order_bundle',
      table: 'orders',
      data: {
        userId: 'u-1',
        order: { user_id: 'u-1', total_amount: 100 },
        items: [{ product_id: 'p-1', quantity: 1, price_at_order: 100 }],
      },
    });
  });

  it('creates order and inserts order items when online', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: true });

    mockSingle.mockResolvedValue({
      data: { id: 'order-1', user_id: 'u-1', total_amount: 100 },
      error: null,
    });
    mockSelect.mockReturnValue({ single: mockSingle });

    const mockOrderItemsInsert = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table) => {
      if (table === 'orders') {
        return {
          insert: (...args) => {
            mockInsert(...args);
            return { select: mockSelect };
          },
        };
      }

      return { insert: mockOrderItemsInsert };
    });

    const { orderService } = require('../../services/orderService');

    const result = await orderService.createOrderWithItems({
      userId: 'u-1',
      orderInsert: { user_id: 'u-1', total_amount: 100 },
      orderItems: [{ product_id: 'p-1', quantity: 1, price_at_order: 100 }],
    });

    expect(result).toEqual({
      success: true,
      queued: false,
      order: { id: 'order-1', user_id: 'u-1', total_amount: 100 },
    });
    expect(mockInsert).toHaveBeenCalledWith([{ user_id: 'u-1', total_amount: 100 }]);
    expect(mockOrderItemsInsert).toHaveBeenCalledWith([
      { product_id: 'p-1', quantity: 1, price_at_order: 100, order_id: 'order-1' },
    ]);
  });

  it('queues updateOrder when offline', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: false });
    mockQueueOperation.mockResolvedValue({ success: true, queueId: 'q-2' });

    const { orderService } = require('../../services/orderService');

    const result = await orderService.updateOrder({
      orderId: 'o-1',
      userId: 'u-1',
      updates: { status: 'Cancelled' },
    });

    expect(result).toEqual({ success: true, queued: true });
    expect(mockQueueOperation).toHaveBeenCalledWith({
      type: 'update',
      table: 'orders',
      recordId: 'o-1',
      match: { id: 'o-1', user_id: 'u-1' },
      data: { status: 'Cancelled' },
    });
  });

  it('updates order directly when online', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: true });

    mockEq.mockReturnValue({ eq: mockEq });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { orderService } = require('../../services/orderService');

    const result = await orderService.updateOrder({
      orderId: 'o-1',
      userId: 'u-1',
      updates: { status: 'Processing' },
    });

    expect(result).toEqual({ success: true, queued: false });
    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'Processing' });
  });

  it('throws when offline queueing fails', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: false });
    mockQueueOperation.mockResolvedValue({ success: false, error: 'Queue failed' });

    const { orderService } = require('../../services/orderService');

    await expect(
      orderService.updateOrder({
        orderId: 'o-1',
        userId: 'u-1',
        updates: { status: 'Processing' },
      })
    ).rejects.toThrow('Queue failed');
  });

  it('throws fallback message when offline create queueing fails without error text', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: false });
    mockQueueOperation.mockResolvedValue({ success: false });

    const { orderService } = require('../../services/orderService');

    await expect(
      orderService.createOrderWithItems({
        userId: 'u-1',
        orderInsert: { user_id: 'u-1', total_amount: 100 },
        orderItems: [{ product_id: 'p-1', quantity: 1, price_at_order: 100 }],
      })
    ).rejects.toThrow('Failed to queue order while offline.');
  });

  it('throws order insert error when online create fails at order row insert', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: true });

    mockSingle.mockResolvedValue({ data: null, error: new Error('order insert failed') });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockFrom.mockReturnValue({
      insert: jest.fn().mockReturnValue({ select: mockSelect }),
    });

    const { orderService } = require('../../services/orderService');

    await expect(
      orderService.createOrderWithItems({
        userId: 'u-1',
        orderInsert: { user_id: 'u-1', total_amount: 100 },
        orderItems: [{ product_id: 'p-1', quantity: 1, price_at_order: 100 }],
      })
    ).rejects.toThrow('order insert failed');
  });

  it('throws item insert error when online create fails at order items insert', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: true });

    mockSingle.mockResolvedValue({
      data: { id: 'order-2', user_id: 'u-1', total_amount: 100 },
      error: null,
    });
    mockSelect.mockReturnValue({ single: mockSingle });

    const mockOrderItemsInsert = jest.fn().mockResolvedValue({ error: new Error('items insert failed') });
    mockFrom.mockImplementation((table) => {
      if (table === 'orders') {
        return {
          insert: jest.fn().mockReturnValue({ select: mockSelect }),
        };
      }

      return {
        insert: mockOrderItemsInsert,
      };
    });

    const { orderService } = require('../../services/orderService');

    await expect(
      orderService.createOrderWithItems({
        userId: 'u-1',
        orderInsert: { user_id: 'u-1', total_amount: 100 },
        orderItems: [{ product_id: 'p-1', quantity: 1, price_at_order: 100 }],
      })
    ).rejects.toThrow('items insert failed');
  });

  it('throws fallback message when offline update queueing fails without error text', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: false });
    mockQueueOperation.mockResolvedValue({ success: false });

    const { orderService } = require('../../services/orderService');

    await expect(
      orderService.updateOrder({
        orderId: 'o-1',
        userId: 'u-1',
        updates: { status: 'Cancelled' },
      })
    ).rejects.toThrow('Failed to queue order update while offline.');
  });

  it('throws online update error when direct update fails', async () => {
    mockGetStatus.mockResolvedValue({ isOnline: true });

    const secondEq = jest.fn().mockResolvedValue({ error: new Error('update failed') });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    mockUpdate.mockReturnValue({ eq: firstEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const { orderService } = require('../../services/orderService');

    await expect(
      orderService.updateOrder({
        orderId: 'o-1',
        userId: 'u-1',
        updates: { status: 'Processing' },
      })
    ).rejects.toThrow('update failed');
  });

  it('treats status lookup errors as offline and queues operation', async () => {
    mockGetStatus.mockRejectedValue(new Error('status unavailable'));
    mockQueueOperation.mockResolvedValue({ success: true, queueId: 'q-fallback-offline' });

    const { orderService } = require('../../services/orderService');

    const result = await orderService.updateOrder({
      orderId: 'o-2',
      userId: 'u-2',
      updates: { status: 'Processing' },
    });

    expect(result).toEqual({ success: true, queued: true });
    expect(mockQueueOperation).toHaveBeenCalled();
  });
});