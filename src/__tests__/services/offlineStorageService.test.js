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
});
