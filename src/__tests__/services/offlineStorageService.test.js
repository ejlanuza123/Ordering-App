jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const { offlineStorageService } = require('../../services/offlineStorageService');

describe('offlineStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    AsyncStorage.multiRemove.mockResolvedValue(undefined);
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('queues operation with queueId and recordId', async () => {
    AsyncStorage.getItem.mockResolvedValue('[]');
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const result = await offlineStorageService.queueOperation({
      type: 'update',
      table: 'orders',
      data: { id: 'o-1', status: 'Processing' },
    });

    expect(result.success).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    const [, payload] = AsyncStorage.setItem.mock.calls[0];
    const queued = JSON.parse(payload);

    expect(queued).toHaveLength(1);
    expect(queued[0]).toEqual(
      expect.objectContaining({
        type: 'update',
        table: 'orders',
        recordId: 'o-1',
        timestamp: 1000,
      })
    );
    expect(queued[0].queueId).toBeTruthy();
  });

  it('processes successful queued operations and clears queue', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q1',
          type: 'update',
          table: 'orders',
          recordId: 'o-1',
          data: { status: 'Completed' },
        },
      ])
    );

    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 1, pending: 0 });
    expect(update).toHaveBeenCalledWith({ status: 'Completed' });
    expect(eq).toHaveBeenCalledWith('id', 'o-1');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('sync_queue');
  });

  it('keeps failed operations in queue for later retry (conflict/failure handling)', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q1',
          type: 'update',
          table: 'orders',
          recordId: 'o-1',
          data: { status: 'Completed' },
        },
      ])
    );

    const eq = jest.fn().mockResolvedValue({ error: new Error('conflict') });
    const update = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 0, pending: 1 });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'sync_queue',
      expect.stringContaining('q1')
    );
  });

  it('saves and retrieves non-expired cached data', async () => {
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        data: { value: 42 },
        timestamp: 1000,
        expiration: 60 * 1000,
      })
    );

    const saveResult = await offlineStorageService.saveData('ORDERS', { value: 42 }, 1);
    const getResult = await offlineStorageService.getData('ORDERS');

    expect(saveResult).toEqual({ success: true });
    expect(getResult).toEqual({ success: true, data: { value: 42 } });
  });

  it('removes expired cached data when fetching', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        data: { value: 7 },
        timestamp: 0,
        expiration: 1,
      })
    );

    const result = await offlineStorageService.getData('ORDERS');

    expect(result).toEqual({ success: false, data: null });
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('cached_orders');
  });

  it('clears all cache keys', async () => {
    AsyncStorage.multiRemove.mockResolvedValue(undefined);

    const result = await offlineStorageService.clearCache();

    expect(result).toEqual({ success: true });
    expect(AsyncStorage.multiRemove).toHaveBeenCalledTimes(1);
  });

  it('processes queued create_order_bundle and clears queue', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q-bundle',
          type: 'create_order_bundle',
          table: 'orders',
          data: {
            order: { user_id: 'u-1', total_amount: 100 },
            items: [{ product_id: 'p-1', quantity: 2, price_at_order: 50 }],
          },
        },
      ])
    );

    const single = jest.fn().mockResolvedValue({ data: { id: 'o-1' }, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insertOrders = jest.fn().mockReturnValue({ select });
    const insertItems = jest.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table) => {
      if (table === 'orders') {
        return { insert: insertOrders };
      }
      if (table === 'order_items') {
        return { insert: insertItems };
      }
      return {};
    });

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 1, pending: 0 });
    expect(insertOrders).toHaveBeenCalledWith([{ user_id: 'u-1', total_amount: 100 }]);
    expect(insertItems).toHaveBeenCalledWith([
      { product_id: 'p-1', quantity: 2, price_at_order: 50, order_id: 'o-1' },
    ]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('sync_queue');
  });

  it('uses custom match filters for update operations', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q-match',
          type: 'update',
          table: 'orders',
          recordId: 'o-5',
          match: { id: 'o-5', user_id: 'u-9' },
          data: { archived: true },
        },
      ])
    );

    const secondEq = jest.fn().mockResolvedValue({ error: null });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const update = jest.fn().mockReturnValue({ eq: firstEq });
    mockFrom.mockReturnValue({ update });

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 1, pending: 0 });
    expect(firstEq).toHaveBeenCalledWith('id', 'o-5');
    expect(secondEq).toHaveBeenCalledWith('user_id', 'u-9');
  });

  it('returns failure for saveData storage errors', async () => {
    AsyncStorage.setItem.mockRejectedValue(new Error('disk full'));

    const result = await offlineStorageService.saveData('ORDERS', { a: 1 });

    expect(result).toEqual({ success: false, error: 'disk full' });
  });

  it('returns failure for getData parse errors', async () => {
    AsyncStorage.getItem.mockResolvedValue('not-json');

    const result = await offlineStorageService.getData('ORDERS');

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns failure when clearCache throws', async () => {
    AsyncStorage.multiRemove.mockRejectedValue(new Error('io error'));

    const result = await offlineStorageService.clearCache();

    expect(result).toEqual({ success: false, error: 'io error' });
  });

  it('returns empty queue when stored queue is not an array', async () => {
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ queue: true }));

    const queue = await offlineStorageService.getSyncQueue();

    expect(queue).toEqual([]);
  });

  it('returns empty queue when sync queue JSON is invalid', async () => {
    AsyncStorage.getItem.mockResolvedValue('{bad');

    const queue = await offlineStorageService.getSyncQueue();

    expect(queue).toEqual([]);
  });

  it('returns failure when queueOperation cannot persist queue', async () => {
    AsyncStorage.getItem.mockResolvedValue('[]');
    AsyncStorage.setItem.mockRejectedValue(new Error('write denied'));

    const result = await offlineStorageService.queueOperation({
      type: 'update',
      table: 'orders',
      data: { id: 'o-2' },
    });

    expect(result).toEqual({ success: false, error: 'write denied' });
  });

  it('computes sync queue health for empty and stuck queues', async () => {
    AsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([]));

    const empty = await offlineStorageService.getSyncQueueHealth(60);
    expect(empty).toEqual({
      success: true,
      pendingCount: 0,
      oldestAgeMs: 0,
      isStuck: false,
    });

    Date.now.mockReturnValue(1_000_000);
    AsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify([
        { queueId: 'q-old', timestamp: 500_000 },
        { queueId: 'q-new', timestamp: 990_000 },
      ])
    );

    const stuck = await offlineStorageService.getSyncQueueHealth(5);
    expect(stuck.success).toBe(true);
    expect(stuck.pendingCount).toBe(2);
    expect(stuck.oldestAgeMs).toBe(500_000);
    expect(stuck.isStuck).toBe(true);
  });

  it('processes create_order operation successfully', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q-create',
          type: 'create_order',
          table: 'orders',
          data: { user_id: 'u-1', total_amount: 50 },
        },
      ])
    );

    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert });

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 1, pending: 0 });
    expect(insert).toHaveBeenCalledWith([{ user_id: 'u-1', total_amount: 50 }]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('sync_queue');
  });

  it('keeps invalid bundle and delete-without-record operations pending', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q-invalid-bundle',
          type: 'create_order_bundle',
          data: { order: null, items: null },
        },
        {
          queueId: 'q-delete-missing-id',
          type: 'delete',
          table: 'orders',
          data: { status: 'x' },
        },
      ])
    );

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 2, pending: 2 });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'sync_queue',
      expect.stringContaining('q-invalid-bundle')
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'sync_queue',
      expect.stringContaining('q-delete-missing-id')
    );
  });

  it('processes delete operation successfully using match filters', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q-delete',
          type: 'delete',
          table: 'orders',
          recordId: 'o-8',
          match: { id: 'o-8', user_id: 'u-1' },
        },
      ])
    );

    const secondEq = jest.fn().mockResolvedValue({ error: null });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const del = jest.fn().mockReturnValue({ eq: firstEq });
    mockFrom.mockReturnValue({ delete: del });

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 1, pending: 0 });
    expect(firstEq).toHaveBeenCalledWith('id', 'o-8');
    expect(secondEq).toHaveBeenCalledWith('user_id', 'u-1');
  });

  it('continues processing when unknown operation type is encountered', async () => {
    AsyncStorage.getItem.mockResolvedValue(
      JSON.stringify([
        {
          queueId: 'q-unknown',
          type: 'noop',
          table: 'orders',
          data: {},
        },
        {
          queueId: 'q-create-2',
          type: 'create_order',
          table: 'orders',
          data: { user_id: 'u-2', total_amount: 25 },
        },
      ])
    );

    const insert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert });

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: true, processed: 1, pending: 1 });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'sync_queue',
      expect.stringContaining('q-unknown')
    );
  });

  it('returns failure when processSyncQueue cannot read queue', async () => {
    jest.spyOn(offlineStorageService, 'getSyncQueue').mockRejectedValue(new Error('queue down'));

    const result = await offlineStorageService.processSyncQueue();

    expect(result).toEqual({ success: false, error: 'queue down' });
  });

  it('updates and reads last sync timestamps', async () => {
    jest.spyOn(offlineStorageService, 'getData').mockResolvedValue({ data: { ORDERS: 111 } });
    const saveSpy = jest.spyOn(offlineStorageService, 'saveData').mockResolvedValue({ success: true });

    Date.now.mockReturnValue(222);
    const updateResult = await offlineStorageService.updateLastSync('PRODUCTS');

    expect(updateResult).toEqual({ success: true });
    expect(saveSpy).toHaveBeenCalledWith('LAST_SYNC', { ORDERS: 111, PRODUCTS: 222 }, 10080);

    offlineStorageService.getData.mockResolvedValue({ data: { PRODUCTS: 333 } });
    const lastSync = await offlineStorageService.getLastSync('PRODUCTS');
    expect(lastSync).toBe(333);
  });
});
